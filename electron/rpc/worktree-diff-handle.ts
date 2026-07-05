import { RpcTarget } from "capnweb";
import type { VirtualWorktree } from "nano-git/worktree/core";

import type { ManuscriptHandle } from "#shared/rpc/projects-rpc";
import type { WorktreeDiffHandle, WorktreeDiffResult } from "#shared/rpc/worktree-diff";

import {
  type ObjectDatabase,
  buildBaseSnapshot,
  buildParentMap,
  computeManuscriptDiffItems,
  computeResourceDiffItems,
  getWorktreeOutline,
  getWorktreeResourcePaths,
  readTextFromTree,
  chapterBodyPath,
  ensureResourcesDirectory,
  toWorktreePath,
  joinWorktreeChild,
  RESOURCES_DIR,
} from "../diff";
import { computeLCS } from "../diff/utils";

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

    const manuscriptItems = computeManuscriptDiffItems(
      this.#objects,
      this.#worktree,
      baseTree,
      baseOutline,
    );
    const resourceItems = computeResourceDiffItems(
      this.#objects,
      this.#worktree,
      baseTree,
      baseResourcePaths,
    );

    return { manuscript: manuscriptItems, resources: resourceItems };
  }

  revert(revertId: string): WorktreeDiffResult {
    if (revertId.startsWith("node:")) {
      this.#revertNode(revertId.slice(5));
    } else if (revertId.startsWith("resource:")) {
      this.#revertResource(revertId.slice(9));
    } else if (revertId.startsWith("reorder:")) {
      this.#revertReorder(revertId);
    } else if (revertId.startsWith("folder:")) {
      this.#revertFolder(revertId.slice(7));
    } else {
      throw new Error(`Unknown revert ID: ${revertId}`);
    }
    return this.compute();
  }

  // ---- 节点 revert ----

  #revertNode(id: string): void {
    const baseTree = this.#worktree.baseTree;
    const { outline: baseOutline } = buildBaseSnapshot(this.#objects, baseTree);
    const baseNodes = baseOutline?.nodes ?? {};
    const baseParentById = baseOutline !== null ? buildParentMap(baseOutline) : new Map();
    const currentNodes = this.#getCurrentOutline()?.nodes ?? {};

    const baseNode = baseNodes[id] ?? null;
    const currentNode = currentNodes[id] ?? null;

    // 删除节点 → 从 base 重建
    if (baseNode !== null && currentNode === null) {
      this.#recreateDeletedNode(id, baseNode, baseParentById);
      return;
    }

    // 新增节点 → 删除
    if (baseNode === null && currentNode !== null) {
      this.#manuscript.deleteNode(id);
      return;
    }

    // 两边都存在 → 逐维度还原
    if (baseNode === null || currentNode === null) return;

    // 内容还原
    if (currentNode.type === "chapter" && baseNode.type === "chapter") {
      const oldContent = readTextFromTree(this.#objects, baseTree, chapterBodyPath(id)) ?? "";
      const bodyPath = chapterBodyPath(id);
      const newContent = this.#worktree.exists(bodyPath)
        ? this.#worktree.readFile(bodyPath).toString("utf-8")
        : "";
      if (oldContent !== newContent) {
        this.#manuscript.writeChapter(id, oldContent);
      }
    }

    // 标题还原
    if (baseNode.title !== currentNode.title) {
      this.#manuscript.renameNode(id, baseNode.title);
    }

    // 父节点还原
    const baseParent = baseParentById.get(id) ?? null;
    const currentParentById = this.#getCurrentParentMap();
    const currentParent = currentParentById.get(id) ?? null;
    if (baseParent !== currentParent) {
      this.#manuscript.moveNode(id, baseParent ?? "root");
    }
  }

  #recreateDeletedNode(
    id: string,
    baseNode: { type: string; title: string; children?: string[] },
    baseParentById: Map<string, string | null>,
  ): void {
    const parentId = baseParentById.get(id) ?? "root";

    if (baseNode.type === "folder") {
      this.#manuscript.createFolder(parentId, baseNode.title);
      const baseTree = this.#worktree.baseTree;
      const { outline: baseOutline } = buildBaseSnapshot(this.#objects, baseTree);
      if (baseOutline !== null && baseNode.children !== undefined) {
        for (const childId of baseNode.children) {
          const childNode = baseOutline.nodes[childId];
          if (childNode !== undefined) {
            this.#recreateDeletedNode(childId, childNode, baseParentById);
          }
        }
      }
    } else {
      this.#manuscript.createChapter(parentId, baseNode.title);
      const baseTree = this.#worktree.baseTree;
      const content = readTextFromTree(this.#objects, baseTree, chapterBodyPath(id)) ?? "";
      if (content !== "") {
        this.#manuscript.writeChapter(id, content);
      }
    }
  }

  // ---- 资源 revert ----

  #revertResource(path: string): void {
    const baseTree = this.#worktree.baseTree;
    const { resourcePaths: baseResourcePaths } = buildBaseSnapshot(this.#objects, baseTree);
    const currentPaths = getWorktreeResourcePaths(this.#worktree);

    const inBase = baseResourcePaths.has(path);
    const inCurrent = currentPaths.has(path);

    ensureResourcesDirectory(this.#worktree);
    const wPath = toWorktreePath(path);

    if (inBase && !inCurrent) {
      const isDir = [...baseResourcePaths].some((p) => p !== path && p.startsWith(path + "/"));
      if (isDir) {
        this.#worktree.mkdir(wPath, { recursive: true });
      } else {
        const parent = wPath.includes("/") ? wPath.slice(0, wPath.lastIndexOf("/")) : "";
        if (parent !== "") {
          this.#worktree.mkdir(parent, { recursive: true });
        }
        const content =
          readTextFromTree(this.#objects, baseTree, joinWorktreeChild(RESOURCES_DIR, path)) ?? "";
        this.#worktree.writeFile(wPath, Buffer.from(content, "utf-8"));
      }
      return;
    }

    if (!inBase && inCurrent) {
      this.#worktree.delete(wPath, { force: true });
      return;
    }

    if (inBase && inCurrent) {
      const oldContent =
        readTextFromTree(this.#objects, baseTree, joinWorktreeChild(RESOURCES_DIR, path)) ?? "";
      const newContent = this.#worktree.readFile(wPath).toString("utf-8");
      if (oldContent !== newContent) {
        this.#worktree.writeFile(wPath, Buffer.from(oldContent, "utf-8"));
      }
    }
  }

  // ---- Reorder revert ----

  #revertReorder(revertId: string): void {
    const parts = revertId.split(":");
    const folderId = parts[1];
    const childId = parts[2];

    const outline = this.#manuscript.getOutline();
    const folderNode = outline.nodes[folderId];
    if (folderNode === undefined || folderNode.type !== "folder") return;

    const currentIndex = folderNode.children.indexOf(childId);
    if (currentIndex === -1) {
      const baseTree = this.#worktree.baseTree;
      const { outline: baseOutline } = buildBaseSnapshot(this.#objects, baseTree);
      if (baseOutline !== null) {
        const childNode = baseOutline.nodes[childId];
        if (childNode !== undefined) {
          const baseParentById = buildParentMap(baseOutline);
          this.#recreateDeletedNode(childId, childNode, baseParentById);
        }
      }
      return;
    }

    const baseTree = this.#worktree.baseTree;
    const { outline: baseOutline } = buildBaseSnapshot(this.#objects, baseTree);
    if (baseOutline === null) return;
    const baseFolderNode = baseOutline.nodes[folderId];
    if (baseFolderNode === undefined || baseFolderNode.type !== "folder") return;

    const currentNodes = outline.nodes;
    const validBefore = baseFolderNode.children.filter((id) => currentNodes[id] !== undefined);
    computeLCS(validBefore, folderNode.children);

    const targetIndex = validBefore.indexOf(childId);
    if (targetIndex === -1) {
      this.#manuscript.deleteNode(childId);
      return;
    }

    this.#manuscript.moveNode(childId, folderId, targetIndex);
  }

  // ---- 文件夹 revert ----

  #revertFolder(folderPath: string): void {
    const result = this.compute();
    const affected = [...result.manuscript, ...result.resources]
      .filter((item) => item.path === folderPath || item.path.startsWith(folderPath + "/"))
      .sort((a, b) => b.depth - a.depth);

    for (const item of affected) {
      this.revert(item.revertId);
    }
  }

  // ---- 内部辅助 ----

  #getCurrentOutline() {
    return getWorktreeOutline(this.#worktree);
  }

  #getCurrentParentMap() {
    const outline = this.#getCurrentOutline();
    return outline !== null ? buildParentMap(outline) : new Map();
  }
}
