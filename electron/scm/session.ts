import type { SHA1 } from "nano-git";
import type { Repository } from "nano-git/repository/core";
import type { VirtualWorktree } from "nano-git/worktree/core";

import type { ManuscriptOutline } from "#shared/rpc/projects-rpc";
import type { ScmSnapshot } from "#shared/rpc/worktree-scm";

import {
  clampChildIndex,
  cloneNode,
  collectDescendantIds,
  findParentId,
  MANUSCRIPT_ROOT_ID,
} from "../manuscript-outline";
import {
  chapterBodyPath,
  ensureManuscriptStorage,
  MANUSCRIPT_OUTLINE_PATH,
} from "../manuscript-path";
import { toWorktreePath } from "../resource-library-path";
import { RpcStreamPublisher } from "../rpc/stream-publisher";
import { buildDetailedScmSnapshot, type DetailedSnapshot } from "../worktree/scm-snapshot-builder";
import {
  buildBaseManuscriptSnapshot,
  buildBaseResourceSnapshot,
  buildCurrentManuscriptSnapshot,
  buildCurrentResourceSnapshot,
  ensureChapterBodiesExist,
  type ObjectDatabase,
  readOutlineFromWorktree,
  verifyResourceTree,
  writeOutlineToWorktree,
} from "../worktree/snapshot-state";

type ExistingWorktreeStatus = {
  hadExistingDraft: boolean;
};

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
    return buildDetailedScmSnapshot({
      revision: this.#revision,
      baseTree,
      warning: this.#warning,
      baseManuscript,
      currentManuscript: buildCurrentManuscriptSnapshot(this.#worktree),
      baseResources: buildBaseResourceSnapshot(this.#objects, baseTree),
      currentResources: buildCurrentResourceSnapshot(this.#worktree),
      handlers: {
        onManuscriptCreate: (id) => () => {
          const outline = readOutlineFromWorktree(this.#worktree);
          const deletedIds = deleteNodeFromOutline(outline, id);
          writeOutlineToWorktree(this.#worktree, outline);
          for (const deletedId of deletedIds) {
            this.#worktree.delete(chapterBodyPath(deletedId), { force: true });
          }
        },
        onManuscriptDelete: (id) => () => {
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
        },
        onManuscriptRename: (id, previous) => () => {
          const outline = readOutlineFromWorktree(this.#worktree);
          const node = outline.nodes[id];
          if (node === undefined) {
            throw new Error(`Manuscript node does not exist: ${id}`);
          }
          node.title = previous.title;
          writeOutlineToWorktree(this.#worktree, outline);
        },
        onManuscriptMove: (id, previous) => () => {
          const outline = readOutlineFromWorktree(this.#worktree);
          moveNodeWithinOutline(outline, id, previous.parentId, previous.index);
          writeOutlineToWorktree(this.#worktree, outline);
        },
        onManuscriptReorder: (id, previous) => () => {
          const outline = readOutlineFromWorktree(this.#worktree);
          moveNodeWithinOutline(outline, id, previous.parentId, previous.index);
          writeOutlineToWorktree(this.#worktree, outline);
        },
        onManuscriptContent: (id, previous) => () => {
          ensureManuscriptStorage(this.#worktree);
          this.#worktree.writeFile(chapterBodyPath(id), Buffer.from(previous.content, "utf-8"));
        },
        onResourceCreate: (path) => () => {
          this.#worktree.delete(toWorktreePath(path), { force: true });
        },
        onResourceDelete: (path, previous) => () => {
          this.#worktree.restore(toWorktreePath(path), {
            force: true,
            recursive: previous.type === "folder",
          });
        },
        onResourceContent: (path) => () => {
          this.#worktree.restore(toWorktreePath(path), { force: true });
        },
      },
    });
  }
}
