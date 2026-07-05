import { RpcTarget } from "capnweb";
import type { SHA1 } from "nano-git";
import { readObject } from "nano-git/objects";
import { readTreeSnapshot } from "nano-git/repository/tree/tree-diff";
import type { VirtualWorktree } from "nano-git/worktree/core";

/** ObjectDatabase 类型（nano-git 未公开导出，从 readTreeSnapshot 参数推导） */
type ObjectDatabase = Parameters<typeof readTreeSnapshot>[0];

import type { ManuscriptOutline, ManuscriptHandle } from "#shared/rpc/projects-rpc";
import type {
  WorktreeDiffHandle,
  WorktreeDiffResult,
  ManuscriptDiff,
  NodeDiff,
  BaseNodeSnapshot,
  DiffStats,
  ResourceDiffEntry,
  ManuscriptRevertTarget,
  ResourceRevertTarget,
} from "#shared/rpc/worktree-diff";

import { chapterBodyPath, MANUSCRIPT_OUTLINE_PATH } from "../manuscript-path";
import {
  toWorktreePath,
  RESOURCES_DIR,
  ensureResourcesDirectory,
  joinWorktreeChild,
} from "../resource-library-path";

// ==================== Base 内容读取 ====================

function readFileFromTree(
  objects: ObjectDatabase,
  treeHash: SHA1,
  filePath: string,
): Buffer | undefined {
  const segments = filePath.split("/");
  let hash: SHA1 = treeHash;

  for (let i = 0; i < segments.length; i++) {
    let obj;
    try {
      obj = readObject(objects, hash);
    } catch {
      return undefined;
    }
    if (obj.type !== "tree") return undefined;

    const entry = obj.entries.find((e) => e.name === segments[i]);
    if (entry === undefined) return undefined;

    if (i === segments.length - 1) {
      let blob;
      try {
        blob = readObject(objects, entry.hash);
      } catch {
        return undefined;
      }
      return blob.type === "blob" ? blob.content : undefined;
    }
    hash = entry.hash;
  }
  return undefined;
}

function readTextFromTree(objects: ObjectDatabase, treeHash: SHA1, path: string): string | null {
  const buf = readFileFromTree(objects, treeHash, path);
  return buf !== undefined ? buf.toString("utf-8") : null;
}

// ==================== Outline 辅助 ====================

function buildParentMap(outline: ManuscriptOutline): Map<string, string | null> {
  const parentById = new Map<string, string | null>();
  for (const [id, node] of Object.entries(outline.nodes)) {
    if (node.type === "folder") {
      for (const childId of node.children) {
        parentById.set(childId, id);
      }
    }
  }
  if (!parentById.has(outline.rootId)) {
    parentById.set(outline.rootId, null);
  }
  return parentById;
}

function parseOutlineOrNull(content: string | null): ManuscriptOutline | null {
  if (content === null) return null;
  try {
    const parsed = JSON.parse(content) as ManuscriptOutline;
    if (
      parsed.version === 1 &&
      parsed.rootId === "root" &&
      typeof parsed.nodes === "object" &&
      parsed.nodes !== null
    ) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

// ==================== 字符级 Diff Stats ====================

function computeStats(oldContent: string, newContent: string): DiffStats {
  if (oldContent === newContent) {
    return { added: 0, removed: 0 };
  }
  if (oldContent === "") {
    return { added: newContent.length, removed: 0 };
  }
  if (newContent === "") {
    return { added: 0, removed: oldContent.length };
  }

  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const m = oldLines.length;
  const n = newLines.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from<number>({ length: n + 1 }).fill(0),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let added = 0;
  let removed = 0;
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      added += newLines[j - 1].length + 1;
      j--;
    } else {
      removed += oldLines[i - 1].length + 1;
      i--;
    }
  }

  return { added, removed };
}

// ==================== Base 快照构建 ====================

interface BaseSnapshot {
  outline: ManuscriptOutline | null;
  resourcePaths: Set<string>;
}

function buildBaseSnapshot(objects: ObjectDatabase, baseTree: SHA1): BaseSnapshot {
  let snapshot;
  try {
    snapshot = readTreeSnapshot(objects, baseTree);
  } catch {
    return { outline: null, resourcePaths: new Set() };
  }

  const outlineContent = readTextFromTree(objects, baseTree, MANUSCRIPT_OUTLINE_PATH);
  const outline = parseOutlineOrNull(outlineContent);

  const resourcePaths = new Set<string>();
  for (const entry of snapshot) {
    if (entry.path.startsWith(`${RESOURCES_DIR}/`)) {
      const rel = entry.path.slice(RESOURCES_DIR.length + 1);
      if (rel !== "") {
        resourcePaths.add(rel);
      }
    }
  }

  return { outline, resourcePaths };
}

// ==================== 正文 Diff 计算 ====================

function computeManuscriptDiff(
  objects: ObjectDatabase,
  worktree: VirtualWorktree,
  baseTree: SHA1,
  baseOutline: ManuscriptOutline | null,
): ManuscriptDiff {
  let currentOutline: ManuscriptOutline | null = null;
  if (worktree.exists(MANUSCRIPT_OUTLINE_PATH)) {
    const content = worktree.readFile(MANUSCRIPT_OUTLINE_PATH).toString("utf-8");
    currentOutline = parseOutlineOrNull(content);
  }

  const nodes: NodeDiff[] = [];

  if (baseOutline === null && currentOutline === null) {
    return { nodes };
  }

  const baseNodes = baseOutline?.nodes ?? {};
  const currentNodes = currentOutline?.nodes ?? {};
  const baseParentById = baseOutline !== null ? buildParentMap(baseOutline) : new Map();
  const currentParentById = currentOutline !== null ? buildParentMap(currentOutline) : new Map();
  const allIds = new Set([...Object.keys(baseNodes), ...Object.keys(currentNodes)]);

  for (const id of allIds) {
    const baseNode = baseNodes[id] ?? null;
    const currentNode = currentNodes[id] ?? null;

    // 删除节点（仅在 base 中）
    if (baseNode !== null && currentNode === null) {
      const baseSnapshot: BaseNodeSnapshot = {
        title: baseNode.title,
        parent: baseParentById.get(id) ?? null,
        children: baseNode.type === "folder" ? [...baseNode.children] : null,
        content:
          baseNode.type === "chapter"
            ? (readTextFromTree(objects, baseTree, chapterBodyPath(id)) ?? "")
            : null,
      };
      nodes.push({
        id,
        type: baseNode.type,
        title: null,
        base: baseSnapshot,
        parent: null,
      });
      continue;
    }

    // 新增节点（仅在 current 中）
    if (baseNode === null && currentNode !== null) {
      const nodeDiff: NodeDiff = {
        id,
        type: currentNode.type,
        title: currentNode.title,
        base: null,
        parent: currentParentById.get(id) ?? null,
      };
      // 新增章节：读取当前内容计算字数统计
      if (currentNode.type === "chapter") {
        const bodyPath = chapterBodyPath(id);
        const content = worktree.exists(bodyPath)
          ? worktree.readFile(bodyPath).toString("utf-8")
          : "";
        if (content.length > 0) {
          nodeDiff.contentChanged = {
            stats: { added: content.length, removed: 0 },
            oldContent: "",
          };
        }
      }
      nodes.push(nodeDiff);
      continue;
    }

    // 两边都存在
    if (baseNode !== null && currentNode !== null) {
      const diff: NodeDiff = {
        id,
        type: currentNode.type,
        title: currentNode.title,
        base: null,
        parent: currentParentById.get(id) ?? null,
      };

      if (baseNode.title !== currentNode.title) {
        diff.titleChanged = { from: baseNode.title, to: currentNode.title };
      }

      const baseParent = baseParentById.get(id) ?? null;
      const currentParent = currentParentById.get(id) ?? null;
      if (baseParent !== currentParent) {
        diff.parentChanged = { from: baseParent, to: currentParent };
      }

      if (currentNode.type === "chapter" && baseNode.type === "chapter") {
        const bodyPath = chapterBodyPath(id);
        const oldContent = readTextFromTree(objects, baseTree, bodyPath) ?? "";
        const newContent = worktree.exists(bodyPath)
          ? worktree.readFile(bodyPath).toString("utf-8")
          : "";
        if (oldContent !== newContent) {
          diff.contentChanged = {
            stats: computeStats(oldContent, newContent),
            oldContent,
          };
        }
      }

      if (currentNode.type === "folder" && baseNode.type === "folder") {
        const baseChildren = baseNode.children;
        const currentChildren = currentNode.children;
        if (
          baseChildren.length !== currentChildren.length ||
          baseChildren.some((c, i) => c !== currentChildren[i])
        ) {
          diff.childrenChanged = {
            before: [...baseChildren],
            after: [...currentChildren],
          };
        }
      }

      nodes.push(diff);
    }
  }

  return { nodes };
}

// ==================== 资源 Diff 计算 ====================

function computeResourceDiff(
  objects: ObjectDatabase,
  worktree: VirtualWorktree,
  baseTree: SHA1,
  baseResourcePaths: Set<string>,
): ResourceDiffEntry[] {
  ensureResourcesDirectory(worktree);
  const entries: ResourceDiffEntry[] = [];
  const resolveWtPath = (p: string) => toWorktreePath(p);

  const currentPaths = new Set<string>();
  const visitDirectory = (rpcPath: string): void => {
    const wPath = resolveWtPath(rpcPath);
    const dirEntries = worktree.readdir(wPath);
    for (const entry of dirEntries) {
      if (entry.kind !== "blob" && entry.kind !== "tree") continue;
      const childPath = rpcPath === "" ? entry.name : `${rpcPath}/${entry.name}`;
      currentPaths.add(childPath);
      if (entry.kind === "tree") {
        visitDirectory(childPath);
      }
    }
  };
  visitDirectory("");

  // base 中有、current 中无 → removed
  for (const basePath of baseResourcePaths) {
    if (!currentPaths.has(basePath)) {
      const isDir = [...baseResourcePaths].some(
        (p) => p !== basePath && p.startsWith(basePath + "/"),
      );
      if (isDir) {
        entries.push({ kind: "removed", path: basePath, resourceKind: "folder" });
      } else {
        const oldContent =
          readTextFromTree(objects, baseTree, joinWorktreeChild(RESOURCES_DIR, basePath)) ?? "";
        entries.push({
          kind: "removed",
          path: basePath,
          resourceKind: "file",
          stats: { added: 0, removed: oldContent.length },
          oldContent,
        });
      }
    }
  }

  // current 中有、base 中无 → added
  for (const currentPath of currentPaths) {
    if (!baseResourcePaths.has(currentPath)) {
      const isDir = [...currentPaths].some(
        (p) => p !== currentPath && p.startsWith(currentPath + "/"),
      );
      if (isDir) {
        entries.push({ kind: "added", path: currentPath, resourceKind: "folder" });
      } else {
        const content = worktree.readFile(resolveWtPath(currentPath)).toString("utf-8");
        entries.push({
          kind: "added",
          path: currentPath,
          resourceKind: "file",
          stats: { added: content.length, removed: 0 },
        });
      }
    }
  }

  // 两边都有 → 检查内容
  for (const path of currentPaths) {
    if (!baseResourcePaths.has(path)) continue;
    const isDir = [...currentPaths].some((p) => p !== path && p.startsWith(path + "/"));
    if (isDir) continue;

    const oldContent =
      readTextFromTree(objects, baseTree, joinWorktreeChild(RESOURCES_DIR, path)) ?? "";
    const newContent = worktree.readFile(resolveWtPath(path)).toString("utf-8");
    if (oldContent !== newContent) {
      entries.push({
        kind: "modified",
        path,
        stats: computeStats(oldContent, newContent),
        oldContent,
      });
    }
  }

  return entries;
}

// ==================== RPC 实现 ====================

export class WorktreeDiffHandleImpl extends RpcTarget implements WorktreeDiffHandle {
  readonly #worktree: VirtualWorktree;
  readonly #objects: ObjectDatabase;
  readonly #manuscript: ManuscriptHandle;

  constructor(worktree: VirtualWorktree, objects: ObjectDatabase, manuscript: ManuscriptHandle) {
    super();
    this.#worktree = worktree;
    this.#objects = objects;
    this.#manuscript = manuscript;
  }

  compute(): WorktreeDiffResult {
    const baseTree = this.#worktree.baseTree;
    const { outline: baseOutline, resourcePaths: baseResourcePaths } = buildBaseSnapshot(
      this.#objects,
      baseTree,
    );

    const manuscript = computeManuscriptDiff(this.#objects, this.#worktree, baseTree, baseOutline);

    const resources = computeResourceDiff(
      this.#objects,
      this.#worktree,
      baseTree,
      baseResourcePaths,
    );

    return { manuscript, resources };
  }

  revertManuscript(target: ManuscriptRevertTarget): void {
    const result = this.compute();
    const nodeDiff = result.manuscript.nodes.find((n) => n.id === target.id);
    if (nodeDiff === undefined) {
      throw new Error(`No diff found for node: ${target.id}`);
    }

    switch (target.dimension) {
      case "all":
        this.#revertNodeAll(nodeDiff);
        break;
      case "title":
        this.#revertNodeTitle(nodeDiff);
        break;
      case "parent":
        this.#revertNodeParent(nodeDiff);
        break;
      case "content":
        this.#revertNodeContent(nodeDiff);
        break;
      case "children":
        this.#revertNodeChildren(nodeDiff);
        break;
    }
  }

  revertResource(target: ResourceRevertTarget): void {
    const result = this.compute();
    const entry = result.resources.find((r) => r.path === target.path);
    if (entry === undefined) {
      throw new Error(`No diff found for resource: ${target.path}`);
    }

    ensureResourcesDirectory(this.#worktree);
    const wPath = toWorktreePath(target.path);

    switch (entry.kind) {
      case "added":
        this.#worktree.delete(wPath, { force: true });
        break;
      case "removed":
        if (entry.resourceKind === "folder") {
          this.#worktree.mkdir(wPath, { recursive: true });
        } else {
          const parent = wPath.includes("/") ? wPath.slice(0, wPath.lastIndexOf("/")) : "";
          if (parent !== "") {
            this.#worktree.mkdir(parent, { recursive: true });
          }
          this.#worktree.writeFile(wPath, Buffer.from(entry.oldContent, "utf-8"));
        }
        break;
      case "modified":
        this.#worktree.writeFile(wPath, Buffer.from(entry.oldContent, "utf-8"));
        break;
    }
  }

  #revertNodeAll(diff: NodeDiff): void {
    if (diff.base === null) {
      this.#manuscript.deleteNode(diff.id);
      return;
    }

    if (diff.title === null) {
      this.#recreateDeletedNode(diff);
      return;
    }

    if (diff.contentChanged !== undefined) {
      this.#revertNodeContent(diff);
    }
    if (diff.titleChanged !== undefined) {
      this.#revertNodeTitle(diff);
    }
    if (diff.parentChanged !== undefined) {
      this.#revertNodeParent(diff);
    }
    if (diff.childrenChanged !== undefined) {
      this.#revertNodeChildren(diff);
    }
  }

  #recreateDeletedNode(diff: NodeDiff): void {
    if (diff.base === null) return;
    const { base, id, type } = diff;
    const parentId = base.parent ?? "root";

    if (type === "folder") {
      this.#manuscript.createFolder(parentId, base.title);
    } else {
      this.#manuscript.createChapter(parentId, base.title);
      if (base.content !== null) {
        this.#manuscript.writeChapter(id, base.content);
      }
    }
  }

  #revertNodeTitle(diff: NodeDiff): void {
    if (diff.titleChanged === undefined) return;
    this.#manuscript.renameNode(diff.id, diff.titleChanged.from);
  }

  #revertNodeParent(diff: NodeDiff): void {
    if (diff.parentChanged === undefined) return;
    const targetParent = diff.parentChanged.from ?? "root";
    this.#manuscript.moveNode(diff.id, targetParent);
  }

  #revertNodeContent(diff: NodeDiff): void {
    if (diff.contentChanged === undefined) return;
    this.#manuscript.writeChapter(diff.id, diff.contentChanged.oldContent);
  }

  #revertNodeChildren(diff: NodeDiff): void {
    if (diff.childrenChanged === undefined) return;

    const outline = this.#manuscript.getOutline();
    const folderNode = outline.nodes[diff.id];
    if (folderNode === undefined || folderNode.type !== "folder") return;

    const validChildren = diff.childrenChanged.before.filter(
      (childId) => outline.nodes[childId] !== undefined,
    );

    for (let i = 0; i < validChildren.length; i++) {
      const childId = validChildren[i];
      this.#manuscript.moveNode(childId, diff.id, i);
    }
  }
}
