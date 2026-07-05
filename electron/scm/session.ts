import { createHash } from "node:crypto";

import type { SHA1 } from "nano-git";
import type { Repository } from "nano-git/repository/core";
import { readTreeSnapshot } from "nano-git/repository/tree/tree-diff";
import type { VirtualWorktree } from "nano-git/worktree/core";

import type { ManuscriptNode, ManuscriptOutline } from "#shared/rpc/projects-rpc";
import type { ScmChange, ScmChangeStats, ScmSnapshot } from "#shared/rpc/worktree-scm";

import { readTextFromTree } from "../diff/utils";
import {
  clampChildIndex,
  cloneNode,
  cloneOutline,
  collectDescendantIds,
  createEmptyOutline,
  findParentId,
  MANUSCRIPT_ROOT_ID,
  parseOutline,
  validateOutline,
} from "../manuscript-outline";
import {
  chapterBodyPath,
  ensureManuscriptStorage,
  MANUSCRIPT_OUTLINE_PATH,
} from "../manuscript-path";
import { joinWorktreeChild, RESOURCES_DIR, toWorktreePath } from "../resource-library-path";
import { RpcStreamPublisher } from "../rpc/stream-publisher";

type ObjectDatabase = Parameters<typeof readTreeSnapshot>[0];

type ManuscriptEntry = {
  id: string;
  type: ManuscriptNode["type"];
  title: string;
  parentId: string;
  index: number;
  depth: number;
  displayPath: string;
  order: number;
  childIds: string[];
  content: string;
};

type ManuscriptSnapshotState = {
  outline: ManuscriptOutline;
  entries: Map<string, ManuscriptEntry>;
};

type ResourceEntry = {
  path: string;
  type: "file" | "folder";
  name: string;
  parentPath: string;
  depth: number;
  displayPath: string;
  order: number;
  content: string;
  hash: string;
};

type ResourceSnapshotState = {
  entries: Map<string, ResourceEntry>;
};

type DetailedSnapshot = {
  snapshot: ScmSnapshot;
  changeHandlers: Map<string, () => void>;
};

type ExistingWorktreeStatus = {
  hadExistingDraft: boolean;
};

function sha1Text(content: string): string {
  return createHash("sha1").update(content).digest("hex");
}

function computeStats(previous: string, current: string): ScmChangeStats {
  if (previous === current) {
    return { added: 0, removed: 0 };
  }
  if (previous === "") {
    return { added: current.length, removed: 0 };
  }
  if (current === "") {
    return { added: 0, removed: previous.length };
  }

  const oldLines = previous.split("\n");
  const newLines = current.split("\n");
  const rows = oldLines.length;
  const cols = newLines.length;
  const dp: number[][] = Array.from({ length: rows + 1 }, () => Array<number>(cols + 1).fill(0));

  for (let row = 1; row <= rows; row += 1) {
    for (let col = 1; col <= cols; col += 1) {
      if (oldLines[row - 1] === newLines[col - 1]) {
        dp[row][col] = dp[row - 1]![col - 1]! + 1;
      } else {
        dp[row][col] = Math.max(dp[row - 1]![col]!, dp[row][col - 1]!);
      }
    }
  }

  let added = 0;
  let removed = 0;
  let row = rows;
  let col = cols;

  while (row > 0 || col > 0) {
    if (row > 0 && col > 0 && oldLines[row - 1] === newLines[col - 1]) {
      row -= 1;
      col -= 1;
      continue;
    }
    if (col > 0 && (row === 0 || dp[row]![col - 1]! >= dp[row - 1]![col]!)) {
      added += newLines[col - 1]!.length + 1;
      col -= 1;
      continue;
    }
    removed += oldLines[row - 1]!.length + 1;
    row -= 1;
  }

  return { added, removed };
}

function readOutlineFromWorktree(worktree: VirtualWorktree): ManuscriptOutline {
  if (!worktree.exists(MANUSCRIPT_OUTLINE_PATH)) {
    return createEmptyOutline();
  }
  const stat = worktree.stat(MANUSCRIPT_OUTLINE_PATH);
  if (stat?.kind !== "blob") {
    throw new Error("Manuscript outline path is not a file.");
  }
  return parseOutline(worktree.readFile(MANUSCRIPT_OUTLINE_PATH).toString("utf-8"));
}

function writeOutlineToWorktree(worktree: VirtualWorktree, outline: ManuscriptOutline): void {
  ensureManuscriptStorage(worktree);
  const validated = validateOutline(cloneOutline(outline));
  worktree.writeFile(
    MANUSCRIPT_OUTLINE_PATH,
    Buffer.from(`${JSON.stringify(validated, null, 2)}\n`, "utf-8"),
  );
}

function readOutlineFromBase(objects: ObjectDatabase, baseTree: SHA1): ManuscriptOutline {
  const content = readTextFromTree(objects, baseTree, MANUSCRIPT_OUTLINE_PATH);
  return content === null ? createEmptyOutline() : parseOutline(content);
}

function resourceParentPath(path: string): string {
  const index = path.lastIndexOf("/");
  return index >= 0 ? path.slice(0, index) : "";
}

function resourceBaseName(path: string): string {
  const index = path.lastIndexOf("/");
  return index >= 0 ? path.slice(index + 1) : path;
}

function resourceDepth(path: string): number {
  return path === "" ? 0 : path.split("/").length - 1;
}

function buildManuscriptSnapshot(
  outline: ManuscriptOutline,
  readChapter: (id: string) => string,
): ManuscriptSnapshotState {
  const entries = new Map<string, ManuscriptEntry>();
  let order = 0;

  const visit = (parentId: string, parentPath: string, depth: number): void => {
    const parent = outline.nodes[parentId];
    if (parent?.type !== "folder") {
      return;
    }

    parent.children.forEach((childId, index) => {
      const node = outline.nodes[childId];
      if (node === undefined) {
        throw new Error(`Missing manuscript node: ${childId}`);
      }
      const displayPath = parentPath === "" ? node.title : `${parentPath}/${node.title}`;
      const entry: ManuscriptEntry = {
        id: node.id,
        type: node.type,
        title: node.title,
        parentId,
        index,
        depth,
        displayPath,
        order,
        childIds: node.type === "folder" ? [...node.children] : [],
        content: node.type === "chapter" ? readChapter(node.id) : "",
      };
      entries.set(node.id, entry);
      order += 1;

      if (node.type === "folder") {
        visit(node.id, displayPath, depth + 1);
      }
    });
  };

  visit(outline.rootId, "", 0);

  return { outline, entries };
}

function buildBaseManuscriptSnapshot(
  objects: ObjectDatabase,
  baseTree: SHA1,
): ManuscriptSnapshotState {
  const outline = readOutlineFromBase(objects, baseTree);
  return buildManuscriptSnapshot(
    outline,
    (id) => readTextFromTree(objects, baseTree, chapterBodyPath(id)) ?? "",
  );
}

function buildCurrentManuscriptSnapshot(worktree: VirtualWorktree): ManuscriptSnapshotState {
  const outline = readOutlineFromWorktree(worktree);
  return buildManuscriptSnapshot(outline, (id) =>
    worktree.exists(chapterBodyPath(id))
      ? worktree.readFile(chapterBodyPath(id)).toString("utf-8")
      : "",
  );
}

function buildBaseResourceSnapshot(objects: ObjectDatabase, baseTree: SHA1): ResourceSnapshotState {
  const entries = new Map<string, ResourceEntry>();
  let order = 0;

  for (const snapshotEntry of readTreeSnapshot(objects, baseTree)) {
    const { path, object } = snapshotEntry;
    if (!path.startsWith(`${RESOURCES_DIR}/`)) {
      continue;
    }
    const relativePath = path.slice(RESOURCES_DIR.length + 1);
    if (relativePath === "") {
      continue;
    }
    entries.set(relativePath, {
      path: relativePath,
      type: object.kind === "tree" ? "folder" : "file",
      name: resourceBaseName(relativePath),
      parentPath: resourceParentPath(relativePath),
      depth: resourceDepth(relativePath),
      displayPath: relativePath,
      order,
      content:
        object.kind === "blob"
          ? (readTextFromTree(objects, baseTree, joinWorktreeChild(RESOURCES_DIR, relativePath)) ??
            "")
          : "",
      hash: object.kind === "blob" ? object.hash : object.hash,
    });
    order += 1;
  }

  return { entries };
}

function buildCurrentResourceSnapshot(worktree: VirtualWorktree): ResourceSnapshotState {
  const entries = new Map<string, ResourceEntry>();
  let order = 0;

  if (!worktree.exists(RESOURCES_DIR)) {
    return { entries };
  }

  const visit = (resourcePath: string): void => {
    const worktreePath = resourcePath === "" ? RESOURCES_DIR : toWorktreePath(resourcePath);
    const dirEntries = worktree
      .readdir(worktreePath)
      .filter((entry) => entry.kind === "blob" || entry.kind === "tree")
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const dirEntry of dirEntries) {
      const childPath = resourcePath === "" ? dirEntry.name : `${resourcePath}/${dirEntry.name}`;
      const type = dirEntry.kind === "tree" ? "folder" : "file";
      const content =
        type === "file" ? worktree.readFile(toWorktreePath(childPath)).toString("utf-8") : "";
      entries.set(childPath, {
        path: childPath,
        type,
        name: dirEntry.name,
        parentPath: resourceParentPath(childPath),
        depth: resourceDepth(childPath),
        displayPath: childPath,
        order,
        content,
        hash: type === "file" ? sha1Text(content) : sha1Text(`folder:${childPath}`),
      });
      order += 1;

      if (type === "folder") {
        visit(childPath);
      }
    }
  };

  visit("");

  return { entries };
}

function moveNodeWithinOutline(
  outline: ManuscriptOutline,
  id: string,
  targetParentId: string,
  index: number,
): void {
  if (id === MANUSCRIPT_ROOT_ID) {
    throw new Error("Cannot move the manuscript root.");
  }
  const sourceParentId = findParentId(outline, id);
  if (sourceParentId === null) {
    throw new Error(`Manuscript node has no parent: ${id}`);
  }
  if (targetParentId === id || collectDescendantIds(outline, id).includes(targetParentId)) {
    throw new Error("Cannot move a manuscript node into itself or its descendants.");
  }

  const sourceParent = outline.nodes[sourceParentId];
  const targetParent = outline.nodes[targetParentId];
  if (sourceParent?.type !== "folder" || targetParent?.type !== "folder") {
    throw new Error("Manuscript move target must be a folder.");
  }

  const previousIndex = sourceParent.children.indexOf(id);
  if (previousIndex === -1) {
    throw new Error(`Manuscript node is missing from parent: ${id}`);
  }
  sourceParent.children.splice(previousIndex, 1);

  const insertionIndex =
    sourceParent.id === targetParent.id && index > previousIndex
      ? clampChildIndex(index - 1, targetParent.children.length)
      : clampChildIndex(index, targetParent.children.length);
  targetParent.children.splice(insertionIndex, 0, id);
}

function deleteNodeFromOutline(outline: ManuscriptOutline, id: string): string[] {
  const parentId = findParentId(outline, id);
  if (parentId === null) {
    throw new Error(`Manuscript node has no parent: ${id}`);
  }
  const parent = outline.nodes[parentId];
  if (parent?.type !== "folder") {
    throw new Error("Manuscript node parent must be a folder.");
  }
  const deleteIds = [id, ...collectDescendantIds(outline, id)];
  parent.children = parent.children.filter((childId) => childId !== id);
  for (const deleteId of deleteIds) {
    delete outline.nodes[deleteId];
  }
  return deleteIds;
}

function restoreDeletedSubtreeInOutline(
  outline: ManuscriptOutline,
  baseOutline: ManuscriptOutline,
  id: string,
): string[] {
  const baseNode = baseOutline.nodes[id];
  if (baseNode === undefined) {
    throw new Error(`Base manuscript node does not exist: ${id}`);
  }
  const parentId = findParentId(baseOutline, id) ?? baseOutline.rootId;
  const baseParent = baseOutline.nodes[parentId];
  const currentParent = outline.nodes[parentId];
  if (baseParent?.type !== "folder" || currentParent?.type !== "folder") {
    throw new Error("Cannot restore manuscript subtree into a non-folder parent.");
  }

  const subtreeIds = [id, ...collectDescendantIds(baseOutline, id)];
  for (const subtreeId of subtreeIds) {
    const subtreeNode = baseOutline.nodes[subtreeId];
    if (subtreeNode !== undefined) {
      outline.nodes[subtreeId] = cloneNode(subtreeNode);
    }
  }

  const baseIndex = baseParent.children.indexOf(id);
  currentParent.children.splice(clampChildIndex(baseIndex, currentParent.children.length), 0, id);
  return subtreeIds;
}

function ensureChapterBodiesExist(worktree: VirtualWorktree, outline: ManuscriptOutline): void {
  for (const node of Object.values(outline.nodes)) {
    if (node.type !== "chapter") {
      continue;
    }
    const stat = worktree.stat(chapterBodyPath(node.id));
    if (stat?.kind !== "blob") {
      throw new Error(`Manuscript chapter body is missing: ${node.id}`);
    }
  }
}

function verifyResourceTree(worktree: VirtualWorktree): void {
  if (!worktree.exists(RESOURCES_DIR)) {
    return;
  }

  const visit = (worktreePath: string): void => {
    const stat = worktree.stat(worktreePath);
    if (stat?.kind !== "tree") {
      throw new Error(`Resource path is not a folder: ${worktreePath}`);
    }
    for (const entry of worktree.readdir(worktreePath)) {
      const childPath = joinWorktreeChild(worktreePath, entry.name);
      if (entry.kind === "tree") {
        visit(childPath);
        continue;
      }
      if (entry.kind !== "blob") {
        throw new Error(`Unsupported resource entry kind: ${entry.kind}`);
      }
      const childStat = worktree.stat(childPath);
      if (childStat?.kind !== "blob") {
        throw new Error(`Resource file is not readable: ${childPath}`);
      }
    }
  };

  visit(RESOURCES_DIR);
}

export class ScmSession {
  readonly #worktree: VirtualWorktree;
  readonly #objects: ObjectDatabase;
  readonly #repo: Repository;
  readonly #branchName: string;
  readonly #publisher = new RpcStreamPublisher<ScmSnapshot>();
  #revision = 0;
  #warning: string | null = null;

  constructor(
    worktree: VirtualWorktree,
    objects: ObjectDatabase,
    repo: Repository,
    branchName: string,
    status: ExistingWorktreeStatus,
  ) {
    this.#worktree = worktree;
    this.#objects = objects;
    this.#repo = repo;
    this.#branchName = branchName;
    this.#hydrateOrReset(status);
  }

  subscribeSnapshot(): ReadableStream<ScmSnapshot> {
    return this.#publisher.subscribe({
      getInitialValue: () => this.#computeDetailedSnapshot().snapshot,
    });
  }

  handleExternalMutation(): void {
    this.#warning = null;
    this.#revision += 1;
    this.#publisher.emit(this.#computeDetailedSnapshot().snapshot);
  }

  revertChange(changeId: string): ScmSnapshot {
    const detailed = this.#computeDetailedSnapshot();
    const handler = detailed.changeHandlers.get(changeId);
    if (!handler) {
      throw new Error(`Unknown SCM change: ${changeId}`);
    }
    handler();
    this.#warning = null;
    this.#revision += 1;
    const snapshot = this.#computeDetailedSnapshot().snapshot;
    this.#publisher.emit(snapshot);
    return snapshot;
  }

  commit(message: string, author: { name: string; email: string }): ScmSnapshot {
    const tree = this.#worktree.writeTree();
    const parentCommit = this.#repo.readBranch(this.#branchName);
    const parents: SHA1[] = parentCommit !== null ? [parentCommit] : [];
    const now = Math.floor(Date.now() / 1000);
    const gitAuthor = { name: author.name, email: author.email, timestamp: now, timezone: "+0000" };

    const commitHash = this.#repo.createCommit(tree, parents, message, gitAuthor);
    this.#repo.updateRef(`refs/heads/${this.#branchName}`, commitHash);
    this.#worktree.reset(tree);
    this.#warning = null;
    this.#revision += 1;
    const snapshot = this.#computeDetailedSnapshot().snapshot;
    this.#publisher.emit(snapshot);
    return snapshot;
  }

  #hydrateOrReset(status: ExistingWorktreeStatus): void {
    if (!status.hadExistingDraft) {
      return;
    }

    try {
      if (this.#worktree.exists(MANUSCRIPT_OUTLINE_PATH)) {
        const outline = readOutlineFromWorktree(this.#worktree);
        ensureChapterBodiesExist(this.#worktree, outline);
      }
      verifyResourceTree(this.#worktree);
    } catch (error) {
      this.#worktree.reset(this.#worktree.baseTree);
      this.#warning =
        error instanceof Error
          ? `检测到损坏草稿，已按分支基线重建：${error.message}`
          : "检测到损坏草稿，已按分支基线重建。";
      this.#revision += 1;
    }
  }

  #computeDetailedSnapshot(): DetailedSnapshot {
    const baseTree = this.#worktree.baseTree;
    const baseManuscript = buildBaseManuscriptSnapshot(this.#objects, baseTree);
    const currentManuscript = buildCurrentManuscriptSnapshot(this.#worktree);
    const baseResources = buildBaseResourceSnapshot(this.#objects, baseTree);
    const currentResources = buildCurrentResourceSnapshot(this.#worktree);

    const manuscriptChanges: Array<{ change: ScmChange; order: number }> = [];
    const resourceChanges: Array<{ change: ScmChange; order: number }> = [];
    const changeHandlers = new Map<string, () => void>();

    const manuscriptIds = new Set<string>([
      ...baseManuscript.entries.keys(),
      ...currentManuscript.entries.keys(),
    ]);

    for (const id of manuscriptIds) {
      const previous = baseManuscript.entries.get(id) ?? null;
      const current = currentManuscript.entries.get(id) ?? null;

      if (previous === null && current !== null) {
        const change: ScmChange = {
          id: `manuscript:create:${id}`,
          domain: "manuscript",
          kind: "create",
          entityId: id,
          entityKind: current.type === "chapter" ? "chapter" : "folder",
          label: current.title,
          displayPath: current.displayPath,
          depth: current.depth,
          stats:
            current.type === "chapter" && current.content !== ""
              ? { added: current.content.length, removed: 0 }
              : undefined,
        };
        manuscriptChanges.push({ change, order: current.order });
        changeHandlers.set(change.id, () => {
          const outline = readOutlineFromWorktree(this.#worktree);
          const deletedIds = deleteNodeFromOutline(outline, id);
          writeOutlineToWorktree(this.#worktree, outline);
          for (const deletedId of deletedIds) {
            this.#worktree.delete(chapterBodyPath(deletedId), { force: true });
          }
        });
        continue;
      }

      if (previous !== null && current === null) {
        const change: ScmChange = {
          id: `manuscript:delete:${id}`,
          domain: "manuscript",
          kind: "delete",
          entityId: id,
          entityKind: previous.type === "chapter" ? "chapter" : "folder",
          label: previous.title,
          displayPath: previous.displayPath,
          depth: previous.depth,
          stats:
            previous.type === "chapter" && previous.content !== ""
              ? { added: 0, removed: previous.content.length }
              : undefined,
        };
        manuscriptChanges.push({ change, order: previous.order });
        changeHandlers.set(change.id, () => {
          const outline = readOutlineFromWorktree(this.#worktree);
          const restoredIds = restoreDeletedSubtreeInOutline(outline, baseManuscript.outline, id);
          writeOutlineToWorktree(this.#worktree, outline);
          ensureManuscriptStorage(this.#worktree);
          for (const restoredId of restoredIds) {
            const restoredNode = baseManuscript.outline.nodes[restoredId];
            if (restoredNode?.type !== "chapter") {
              continue;
            }
            this.#worktree.writeFile(
              chapterBodyPath(restoredId),
              Buffer.from(baseManuscript.entries.get(restoredId)?.content ?? "", "utf-8"),
            );
          }
        });
        continue;
      }

      if (previous === null || current === null) {
        continue;
      }

      const entityKind = current.type === "chapter" ? "chapter" : "folder";
      const displayPath = current.displayPath;
      const depth = current.depth;
      const order = current.order;

      if (previous.title !== current.title) {
        const change: ScmChange = {
          id: `manuscript:rename:${id}`,
          domain: "manuscript",
          kind: "rename",
          entityId: id,
          entityKind,
          label: current.title,
          previousLabel: previous.title,
          displayPath,
          depth,
        };
        manuscriptChanges.push({ change, order });
        changeHandlers.set(change.id, () => {
          const outline = readOutlineFromWorktree(this.#worktree);
          const node = outline.nodes[id];
          if (node === undefined) {
            throw new Error(`Manuscript node does not exist: ${id}`);
          }
          node.title = previous.title;
          writeOutlineToWorktree(this.#worktree, outline);
        });
      }

      if (previous.parentId !== current.parentId) {
        const change: ScmChange = {
          id: `manuscript:move:${id}`,
          domain: "manuscript",
          kind: "move",
          entityId: id,
          entityKind,
          label: current.title,
          previousPath: previous.displayPath,
          displayPath,
          depth,
        };
        manuscriptChanges.push({ change, order });
        changeHandlers.set(change.id, () => {
          const outline = readOutlineFromWorktree(this.#worktree);
          moveNodeWithinOutline(outline, id, previous.parentId, previous.index);
          writeOutlineToWorktree(this.#worktree, outline);
        });
      } else if (previous.index !== current.index) {
        const change: ScmChange = {
          id: `manuscript:reorder:${id}`,
          domain: "manuscript",
          kind: "reorder",
          entityId: id,
          entityKind,
          label: current.title,
          previousPath: previous.displayPath,
          displayPath,
          depth,
        };
        manuscriptChanges.push({ change, order });
        changeHandlers.set(change.id, () => {
          const outline = readOutlineFromWorktree(this.#worktree);
          moveNodeWithinOutline(outline, id, previous.parentId, previous.index);
          writeOutlineToWorktree(this.#worktree, outline);
        });
      }

      if (current.type === "chapter" && previous.content !== current.content) {
        const change: ScmChange = {
          id: `manuscript:content:${id}`,
          domain: "manuscript",
          kind: "content",
          entityId: id,
          entityKind: "chapter",
          label: current.title,
          displayPath,
          depth,
          stats: computeStats(previous.content, current.content),
        };
        manuscriptChanges.push({ change, order });
        changeHandlers.set(change.id, () => {
          ensureManuscriptStorage(this.#worktree);
          this.#worktree.writeFile(chapterBodyPath(id), Buffer.from(previous.content, "utf-8"));
        });
      }
    }

    const resourcePaths = new Set<string>([
      ...baseResources.entries.keys(),
      ...currentResources.entries.keys(),
    ]);

    for (const path of resourcePaths) {
      const previous = baseResources.entries.get(path) ?? null;
      const current = currentResources.entries.get(path) ?? null;

      if (previous === null && current !== null) {
        const change: ScmChange = {
          id: `resource:create:${path}`,
          domain: "resource",
          kind: "create",
          entityId: path,
          entityKind: current.type,
          label: current.name,
          displayPath: current.displayPath,
          depth: current.depth,
          stats:
            current.type === "file" && current.content !== ""
              ? { added: current.content.length, removed: 0 }
              : undefined,
        };
        resourceChanges.push({ change, order: current.order });
        changeHandlers.set(change.id, () => {
          this.#worktree.delete(toWorktreePath(path), { force: true });
        });
        continue;
      }

      if (previous !== null && current === null) {
        const change: ScmChange = {
          id: `resource:delete:${path}`,
          domain: "resource",
          kind: "delete",
          entityId: path,
          entityKind: previous.type,
          label: previous.name,
          displayPath: previous.displayPath,
          depth: previous.depth,
          stats:
            previous.type === "file" && previous.content !== ""
              ? { added: 0, removed: previous.content.length }
              : undefined,
        };
        resourceChanges.push({ change, order: previous.order });
        changeHandlers.set(change.id, () => {
          this.#worktree.restore(toWorktreePath(path), {
            force: true,
            recursive: previous.type === "folder",
          });
        });
        continue;
      }

      if (previous === null || current === null) {
        continue;
      }

      if (
        previous.type === "file" &&
        current.type === "file" &&
        previous.content !== current.content
      ) {
        const change: ScmChange = {
          id: `resource:content:${path}`,
          domain: "resource",
          kind: "content",
          entityId: path,
          entityKind: "file",
          label: current.name,
          displayPath: current.displayPath,
          depth: current.depth,
          stats: computeStats(previous.content, current.content),
        };
        resourceChanges.push({ change, order: current.order });
        changeHandlers.set(change.id, () => {
          this.#worktree.restore(toWorktreePath(path), { force: true });
        });
      }
    }

    manuscriptChanges.sort(
      (left, right) =>
        left.order - right.order || left.change.displayPath.localeCompare(right.change.displayPath),
    );
    resourceChanges.sort(
      (left, right) =>
        left.order - right.order || left.change.displayPath.localeCompare(right.change.displayPath),
    );

    return {
      snapshot: {
        revision: this.#revision,
        baseTree,
        hasChanges: manuscriptChanges.length > 0 || resourceChanges.length > 0,
        warning: this.#warning,
        manuscriptChanges: manuscriptChanges.map((item) => item.change),
        resourceChanges: resourceChanges.map((item) => item.change),
      },
      changeHandlers,
    };
  }
}
