import type { SHA1 } from "nano-git";
import { walkLogEntries } from "nano-git/log";
import type { Repository } from "nano-git/repository/core";
import { nanoid } from "nanoid";

import { normalizeResourceNameInput } from "#shared/resource-library-path";
import type { WorktreeNodeIdResult } from "#shared/rpc/projects-rpc";
import type { ScmCommitSummary, ScmSnapshot } from "#shared/rpc/worktree-scm";
import type { WorktreeSearchQuery, WorktreeSearchResult } from "#shared/rpc/worktree-search";
import type {
  FileChangeStatus,
  ManuscriptTreeNode,
  ManuscriptTreeSnapshot,
  ResourceTreeNode,
  ResourceTreeSnapshot,
  WorktreeTreeEvent,
  WorktreeTreeSnapshot,
} from "#shared/rpc/worktree-tree";

import type {
  ManuscriptNodeCommittedRow,
  ManuscriptNodeCurrentRow,
  ResourceNodeCommittedRow,
  ResourceNodeCurrentRow,
  WorktreeRecord,
  WorktreeRepository,
} from "../db/repositories/worktree-repo";
import {
  cloneOutline,
  clampChildIndex,
  createEmptyOutline,
  MANUSCRIPT_ROOT_ID,
  normalizeManuscriptTitle,
  validateOutline,
} from "../manuscript-outline";
import { chapterBodyPath } from "../manuscript-path";
import { assertValidResourceRelativePath, RESOURCES_DIR } from "../resource-library-path";
import { RpcStreamPublisher } from "../rpc/stream-publisher";
import { executeWorktreeSearch } from "../search/worktree-search";
import { refreshAllFolderChangeStatuses } from "./change-status";
import { readTextFromTree, type ObjectDatabase } from "./diff-utils";
import { computeMinimalReorderedManuscriptIds } from "./manuscript-reorder";
import {
  buildDetailedScmSnapshot,
  type ResourceSnapshotEntry,
  type ResourceSnapshotState,
} from "./scm-snapshot-builder";
import {
  buildBaseManuscriptSnapshot,
  buildBaseResourceSnapshot,
  buildManuscriptSnapshot,
  type ManuscriptEntry,
  type ManuscriptSnapshotState,
} from "./snapshot-state";

const MANUSCRIPT_ID_SIZE = 10;
const RESOURCE_ID_SIZE = 10;
const RESOURCE_ROOT_ID = "root";

function cloneManuscriptTreeNode(node: ManuscriptTreeNode): ManuscriptTreeNode {
  return {
    ...node,
    childIds: [...node.childIds],
  };
}

function cloneResourceTreeNode(node: ResourceTreeNode): ResourceTreeNode {
  return {
    ...node,
    childIds: [...node.childIds],
  };
}

function cloneManuscriptTreeSnapshot(snapshot: ManuscriptTreeSnapshot): ManuscriptTreeSnapshot {
  return {
    rootId: snapshot.rootId,
    nodes: Object.fromEntries(
      Object.entries(snapshot.nodes).map(([id, node]) => [id, cloneManuscriptTreeNode(node)]),
    ),
  };
}

function cloneResourceTreeSnapshot(snapshot: ResourceTreeSnapshot): ResourceTreeSnapshot {
  return {
    rootId: snapshot.rootId,
    nodes: Object.fromEntries(
      Object.entries(snapshot.nodes).map(([id, node]) => [id, cloneResourceTreeNode(node)]),
    ),
  };
}

function cloneManuscriptSnapshotState(state: ManuscriptSnapshotState): ManuscriptSnapshotState {
  return {
    outline: cloneOutline(state.outline),
    entries: new Map(
      [...state.entries.entries()].map(([id, entry]) => [
        id,
        {
          ...entry,
          childIds: [...entry.childIds],
        },
      ]),
    ),
  };
}

function cloneResourceSnapshotState(state: ResourceSnapshotState): ResourceSnapshotState {
  return {
    entries: new Map(
      [...state.entries.entries()].map(([id, entry]) => [
        id,
        {
          ...entry,
        },
      ]),
    ),
  };
}

function buildWorktreeTreeSnapshot(
  revision: number,
  manuscript: ManuscriptTreeSnapshot,
  resources: ResourceTreeSnapshot,
): WorktreeTreeSnapshot {
  return {
    revision,
    manuscript: cloneManuscriptTreeSnapshot(manuscript),
    resources: cloneResourceTreeSnapshot(resources),
  };
}

function normalizeResourceNodeName(name: string): string {
  const normalized = normalizeResourceNameInput(name);
  if (normalized === "") {
    throw new Error("Name must not be empty.");
  }
  assertValidResourceRelativePath(normalized);
  if (normalized.includes("/")) {
    throw new Error("Name must not contain '/'.");
  }
  return normalized;
}

function manuscriptTreeFromOutline(
  outline: ReturnType<typeof createEmptyOutline>,
): ManuscriptTreeSnapshot;
function manuscriptTreeFromOutline(
  outline: ManuscriptSnapshotState["outline"],
): ManuscriptTreeSnapshot;
function manuscriptTreeFromOutline(
  outline: ManuscriptSnapshotState["outline"],
): ManuscriptTreeSnapshot {
  const nodes: Record<string, ManuscriptTreeNode> = {};

  const visit = (id: string, parentId: string | null): void => {
    const node = outline.nodes[id];
    if (node === undefined) {
      throw new Error(`Missing manuscript node: ${id}`);
    }
    nodes[id] = {
      id,
      type: node.type,
      title: node.title,
      parentId,
      childIds: node.type === "folder" ? [...node.children] : [],
    };
    if (node.type === "folder") {
      for (const childId of node.children) {
        visit(childId, id);
      }
    }
  };

  visit(outline.rootId, null);
  return {
    rootId: outline.rootId,
    nodes,
  };
}

function manuscriptTreeToOutline(snapshot: ManuscriptTreeSnapshot) {
  const nodes = Object.fromEntries(
    Object.entries(snapshot.nodes).map(([id, node]) => [
      id,
      node.type === "folder"
        ? {
            id,
            type: "folder" as const,
            title: node.title,
            children: [...node.childIds],
          }
        : {
            id,
            type: "chapter" as const,
            title: node.title,
          },
    ]),
  );
  return validateOutline({
    version: 1,
    rootId: snapshot.rootId,
    nodes,
  });
}

function sortResourceChildrenByName(tree: ResourceTreeSnapshot, folderId: string): void {
  const folder = tree.nodes[folderId];
  if (folder === undefined || folder.type !== "folder") {
    return;
  }
  folder.childIds.sort((leftId, rightId) => {
    const left = tree.nodes[leftId];
    const right = tree.nodes[rightId];
    if (left === undefined || right === undefined) {
      return leftId.localeCompare(rightId);
    }
    if (left.type === right.type) {
      return left.name.localeCompare(right.name);
    }
    return left.type === "folder" ? -1 : 1;
  });
}

function clearChangeStatuses<TNode extends { changeStatus?: FileChangeStatus }>(
  nodes: Record<string, TNode>,
): void {
  for (const node of Object.values(nodes)) {
    delete node.changeStatus;
  }
}

function buildResourceSnapshotFromTree(
  tree: ResourceTreeSnapshot,
  readContent: (id: string) => string,
): {
  snapshot: ResourceSnapshotState;
  pathById: Map<string, string>;
  idByPath: Map<string, string>;
} {
  const entries = new Map<string, ResourceSnapshotEntry>();
  const pathById = new Map<string, string>([[tree.rootId, ""]]);
  const idByPath = new Map<string, string>([["", tree.rootId]]);
  let order = 0;

  const visit = (parentId: string, parentPath: string, depth: number): void => {
    const parent = tree.nodes[parentId];
    if (parent?.type !== "folder") {
      return;
    }
    parent.childIds.forEach((childId, index) => {
      const child = tree.nodes[childId];
      if (child === undefined) {
        throw new Error(`Missing resource node: ${childId}`);
      }
      const displayPath = parentPath === "" ? child.name : `${parentPath}/${child.name}`;
      pathById.set(child.id, displayPath);
      idByPath.set(displayPath, child.id);
      entries.set(child.id, {
        id: child.id,
        type: child.type,
        name: child.name,
        parentId,
        index,
        depth,
        displayPath,
        order,
        content: child.type === "file" ? readContent(child.id) : "",
      });
      order += 1;
      if (child.type === "folder") {
        visit(child.id, displayPath, depth + 1);
      }
    });
  };

  visit(tree.rootId, "", 0);
  return {
    snapshot: { entries },
    pathById,
    idByPath,
  };
}

function buildResourceTreeFromCurrentRows(
  rows: readonly ResourceNodeCurrentRow[],
): ResourceTreeSnapshot {
  const nodes: Record<string, ResourceTreeNode> = {};
  const childRowsByParentId = new Map<string, ResourceNodeCurrentRow[]>();

  for (const row of rows) {
    nodes[row.id] = {
      id: row.id,
      type: row.type,
      name: row.name,
      parentId: row.parentId,
      childIds: [],
    };
    if (row.parentId !== null) {
      const siblings = childRowsByParentId.get(row.parentId) ?? [];
      siblings.push(row);
      childRowsByParentId.set(row.parentId, siblings);
    }
  }

  for (const [parentId, childRows] of childRowsByParentId.entries()) {
    const parent = nodes[parentId];
    if (parent === undefined || parent.type !== "folder") {
      throw new Error(`Invalid resource parent: ${parentId}`);
    }
    childRows
      .sort((left, right) => {
        if (left.type !== right.type) {
          return left.type === "folder" ? -1 : 1;
        }
        return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
      })
      .forEach((row) => parent.childIds.push(row.id));
  }

  const root = nodes[RESOURCE_ROOT_ID];
  if (root === undefined || root.type !== "folder" || root.parentId !== null) {
    throw new Error("Resource root is missing.");
  }

  return {
    rootId: RESOURCE_ROOT_ID,
    nodes,
  };
}

function buildResourceTreeFromCommittedRows(
  rows: readonly ResourceNodeCommittedRow[],
): ResourceTreeSnapshot {
  return buildResourceTreeFromCurrentRows(
    rows.map((row) => ({
      projectId: row.projectId,
      branchName: row.branchName,
      id: row.id,
      parentId: row.parentId,
      type: row.type,
      name: row.name,
      content: null,
    })),
  );
}

function buildManuscriptTreeFromCurrentRows(
  rows: readonly ManuscriptNodeCurrentRow[],
): ManuscriptTreeSnapshot {
  const nodes: Record<string, ManuscriptTreeNode> = {};
  const childRowsByParentId = new Map<string, ManuscriptNodeCurrentRow[]>();

  for (const row of rows) {
    nodes[row.id] = {
      id: row.id,
      type: row.type,
      title: row.title,
      parentId: row.parentId,
      childIds: [],
    };
    if (row.parentId !== null) {
      const siblings = childRowsByParentId.get(row.parentId) ?? [];
      siblings.push(row);
      childRowsByParentId.set(row.parentId, siblings);
    }
  }

  for (const [parentId, childRows] of childRowsByParentId.entries()) {
    const parent = nodes[parentId];
    if (parent === undefined || parent.type !== "folder") {
      throw new Error(`Invalid manuscript parent: ${parentId}`);
    }
    childRows
      .sort((left, right) => left.sortIndex - right.sortIndex || left.id.localeCompare(right.id))
      .forEach((row) => parent.childIds.push(row.id));
  }

  const root = nodes[MANUSCRIPT_ROOT_ID];
  if (root === undefined || root.type !== "folder" || root.parentId !== null) {
    throw new Error("Manuscript root is missing.");
  }

  return {
    rootId: MANUSCRIPT_ROOT_ID,
    nodes,
  };
}

function buildManuscriptTreeFromCommittedRows(
  rows: readonly ManuscriptNodeCommittedRow[],
): ManuscriptTreeSnapshot {
  return buildManuscriptTreeFromCurrentRows(
    rows.map((row) => ({
      projectId: row.projectId,
      branchName: row.branchName,
      id: row.id,
      parentId: row.parentId,
      type: row.type,
      title: row.title,
      sortIndex: row.sortIndex,
      content: null,
    })),
  );
}

function sortedEntryValues<T extends { order: number }>(entries: Map<string, T>): T[] {
  return [...entries.values()].sort((left, right) => left.order - right.order);
}

export class WorktreeSession {
  readonly #store: WorktreeRepository;
  readonly #objects: ObjectDatabase;
  readonly #repo: Repository;
  readonly #projectId: number;
  readonly #branchName: string;
  readonly #scmPublisher = new RpcStreamPublisher<ScmSnapshot>();
  readonly #treePublisher = new RpcStreamPublisher<WorktreeTreeEvent>();

  #baseCommitSha: SHA1 | null = null;
  #revision = 0;
  #warning: string | null = null;
  #manuscriptTree!: ManuscriptTreeSnapshot;
  #baseManuscriptTree!: ManuscriptTreeSnapshot;
  #resourceTree!: ResourceTreeSnapshot;
  #baseResourceTree!: ResourceTreeSnapshot;
  #currentManuscript!: ManuscriptSnapshotState;
  #baseManuscript!: ManuscriptSnapshotState;
  #currentResources!: ResourceSnapshotState;
  #baseResources!: ResourceSnapshotState;
  readonly #resourcePathById = new Map<string, string>();
  readonly #resourceIdByPath = new Map<string, string>();

  constructor(
    store: WorktreeRepository,
    objects: ObjectDatabase,
    repo: Repository,
    projectId: number,
    branchName: string,
  ) {
    this.#store = store;
    this.#objects = objects;
    this.#repo = repo;
    this.#projectId = projectId;
    this.#branchName = branchName;
    this.#loadOrSeed();
  }

  get baseTree(): string {
    return this.#resolveBaseTree();
  }

  subscribeScmSnapshot(): ReadableStream<ScmSnapshot> {
    return this.#scmPublisher.subscribe({
      getInitialValue: () => this.#currentScmSnapshot(),
    });
  }

  subscribeTree(): ReadableStream<WorktreeTreeEvent> {
    return this.#treePublisher.subscribe({
      getInitialValue: () => ({
        kind: "snapshot",
        snapshot: buildWorktreeTreeSnapshot(
          this.#revision,
          this.#manuscriptTree,
          this.#resourceTree,
        ),
      }),
    });
  }

  createManuscriptFolder(parentId: string, title: string, index?: number): WorktreeNodeIdResult {
    const parent = this.#requireManuscriptFolder(parentId);
    const nodeId = this.#createUniqueManuscriptId();
    const normalizedTitle = normalizeManuscriptTitle(title);
    parent.childIds.splice(clampChildIndex(index, parent.childIds.length), 0, nodeId);
    this.#manuscriptTree.nodes[nodeId] = {
      id: nodeId,
      type: "folder",
      title: normalizedTitle,
      parentId,
      childIds: [],
    };
    this.#rebuildCurrentManuscriptFromTree();
    this.#persistAndEmit();
    return { nodeId };
  }

  createManuscriptChapter(parentId: string, title: string, index?: number): WorktreeNodeIdResult {
    const parent = this.#requireManuscriptFolder(parentId);
    const nodeId = this.#createUniqueManuscriptId();
    const normalizedTitle = normalizeManuscriptTitle(title);
    parent.childIds.splice(clampChildIndex(index, parent.childIds.length), 0, nodeId);
    this.#manuscriptTree.nodes[nodeId] = {
      id: nodeId,
      type: "chapter",
      title: normalizedTitle,
      parentId,
      childIds: [],
    };
    this.#rebuildCurrentManuscriptFromTree(new Map([[nodeId, ""]]));
    this.#persistAndEmit();
    return { nodeId };
  }

  renameManuscriptNode(id: string, title: string): void {
    const node = this.#requireManuscriptNode(id);
    node.title = normalizeManuscriptTitle(title);
    this.#rebuildCurrentManuscriptFromTree();
    this.#persistAndEmit();
  }

  moveManuscriptNode(id: string, targetParentId: string, index?: number): void {
    if (id === MANUSCRIPT_ROOT_ID) {
      throw new Error("Cannot move the manuscript root.");
    }
    const node = this.#requireManuscriptNode(id);
    if (targetParentId === id || this.#isManuscriptDescendant(id, targetParentId)) {
      throw new Error("Cannot move a manuscript node into itself or its descendants.");
    }
    const sourceParent = this.#requireManuscriptFolder(node.parentId ?? "");
    const targetParent = this.#requireManuscriptFolder(targetParentId);
    const previousIndex = sourceParent.childIds.indexOf(id);
    if (previousIndex === -1) {
      throw new Error(`Manuscript node is missing from parent: ${id}`);
    }
    sourceParent.childIds.splice(previousIndex, 1);
    const insertionIndex =
      sourceParent.id === targetParent.id && index !== undefined && index > previousIndex
        ? clampChildIndex(index - 1, targetParent.childIds.length)
        : clampChildIndex(index, targetParent.childIds.length);
    targetParent.childIds.splice(insertionIndex, 0, id);
    node.parentId = targetParent.id;
    this.#rebuildCurrentManuscriptFromTree();
    this.#persistAndEmit();
  }

  deleteManuscriptNode(id: string): void {
    this.#deleteManuscriptNodeFromCurrent(id);
    this.#persistAndEmit();
  }

  #deleteManuscriptNodeFromCurrent(id: string): void {
    if (id === MANUSCRIPT_ROOT_ID) {
      throw new Error("Cannot delete the manuscript root.");
    }
    const node = this.#requireManuscriptNode(id);
    const parent = this.#requireManuscriptFolder(node.parentId ?? "");
    parent.childIds = parent.childIds.filter((childId) => childId !== id);
    for (const subtreeId of this.#collectManuscriptSubtreeIds(id)) {
      delete this.#manuscriptTree.nodes[subtreeId];
    }
    this.#rebuildCurrentManuscriptFromTree();
  }

  readChapter(id: string): string {
    const node = this.#requireManuscriptNode(id);
    if (node.type !== "chapter") {
      throw new Error(`Manuscript node is not a chapter: ${id}`);
    }
    return this.#currentManuscript.entries.get(id)?.content ?? "";
  }

  writeChapter(id: string, content: string): void {
    const node = this.#requireManuscriptNode(id);
    if (node.type !== "chapter") {
      throw new Error(`Manuscript node is not a chapter: ${id}`);
    }
    const entry = this.#currentManuscript.entries.get(id);
    if (entry === undefined) {
      throw new Error(`Manuscript chapter is missing: ${id}`);
    }
    entry.content = content;
    this.#persistAndEmit();
  }

  createResourceFile(parentId: string, name: string): WorktreeNodeIdResult {
    const parent = this.#requireResourceFolder(parentId);
    const normalizedName = normalizeResourceNodeName(name);
    this.#assertResourceSiblingNameAvailable(parent.id, normalizedName);
    const nodeId = this.#createResourceId();
    this.#resourceTree.nodes[nodeId] = {
      id: nodeId,
      type: "file",
      name: normalizedName,
      parentId,
      childIds: [],
    };
    parent.childIds.push(nodeId);
    sortResourceChildrenByName(this.#resourceTree, parent.id);
    this.#rebuildCurrentResourcesFromTree(new Map([[nodeId, ""]]));
    this.#persistAndEmit();
    return { nodeId };
  }

  createResourceFolder(parentId: string, name: string): WorktreeNodeIdResult {
    const parent = this.#requireResourceFolder(parentId);
    const normalizedName = normalizeResourceNodeName(name);
    this.#assertResourceSiblingNameAvailable(parent.id, normalizedName);
    const nodeId = this.#createResourceId();
    this.#resourceTree.nodes[nodeId] = {
      id: nodeId,
      type: "folder",
      name: normalizedName,
      parentId,
      childIds: [],
    };
    parent.childIds.push(nodeId);
    sortResourceChildrenByName(this.#resourceTree, parent.id);
    this.#rebuildCurrentResourcesFromTree();
    this.#persistAndEmit();
    return { nodeId };
  }

  renameResourceNode(id: string, name: string): void {
    if (id === RESOURCE_ROOT_ID) {
      throw new Error("Cannot rename the resource library root.");
    }
    const node = this.#requireResourceNode(id);
    const parentId = node.parentId;
    if (parentId === null) {
      throw new Error(`Resource node has no parent: ${id}`);
    }
    const normalizedName = normalizeResourceNodeName(name);
    this.#assertResourceSiblingNameAvailable(parentId, normalizedName, id);
    node.name = normalizedName;
    sortResourceChildrenByName(this.#resourceTree, parentId);
    this.#rebuildCurrentResourcesFromTree();
    this.#persistAndEmit();
  }

  moveResourceNode(id: string, targetParentId: string): void {
    if (id === RESOURCE_ROOT_ID) {
      throw new Error("Cannot move the resource library root.");
    }
    const node = this.#requireResourceNode(id);
    if (
      node.type === "folder" &&
      (targetParentId === id || this.#isResourceDescendant(id, targetParentId))
    ) {
      throw new Error("Cannot move a folder into itself or one of its descendants.");
    }
    if (node.parentId === targetParentId) {
      throw new Error("Node is already under the target folder.");
    }
    const sourceParent = this.#requireResourceFolder(node.parentId ?? "");
    const targetParent = this.#requireResourceFolder(targetParentId);
    this.#assertResourceSiblingNameAvailable(targetParentId, node.name);
    sourceParent.childIds = sourceParent.childIds.filter((childId) => childId !== id);
    targetParent.childIds.push(id);
    node.parentId = targetParent.id;
    sortResourceChildrenByName(this.#resourceTree, sourceParent.id);
    sortResourceChildrenByName(this.#resourceTree, targetParent.id);
    this.#rebuildCurrentResourcesFromTree();
    this.#persistAndEmit();
  }

  deleteResourceNode(id: string): void {
    this.#deleteResourceNodeFromCurrent(id);
    this.#persistAndEmit();
  }

  #deleteResourceNodeFromCurrent(id: string): void {
    if (id === RESOURCE_ROOT_ID) {
      throw new Error("Cannot delete the resource library root.");
    }
    const node = this.#requireResourceNode(id);
    const parent = this.#requireResourceFolder(node.parentId ?? "");
    parent.childIds = parent.childIds.filter((childId) => childId !== id);
    for (const subtreeId of this.#collectResourceSubtreeIds(id)) {
      delete this.#resourceTree.nodes[subtreeId];
    }
    this.#rebuildCurrentResourcesFromTree();
  }

  readResourceFile(id: string): string {
    const node = this.#requireResourceNode(id);
    if (node.type !== "file") {
      throw new Error(`Resource node is not a file: ${id}`);
    }
    return this.#currentResources.entries.get(id)?.content ?? "";
  }

  writeResourceFile(id: string, content: string): void {
    const node = this.#requireResourceNode(id);
    if (node.type !== "file") {
      throw new Error(`Resource node is not a file: ${id}`);
    }
    const entry = this.#currentResources.entries.get(id);
    if (entry === undefined) {
      throw new Error(`Resource file is missing: ${id}`);
    }
    entry.content = content;
    this.#persistAndEmit();
  }

  revertScmChange(changeId: string): ScmSnapshot {
    const snapshot = this.#currentScmSnapshot();
    const change = [...snapshot.manuscriptChanges, ...snapshot.resourceChanges].find(
      (candidate) => candidate.id === changeId,
    );
    if (change === undefined) {
      throw new Error(`Unknown SCM change: ${changeId}`);
    }

    const [domain, kind, entityId] = changeId.split(":", 3);
    if (domain === "manuscript") {
      this.#revertManuscriptChange(kind, entityId);
    } else if (domain === "resource") {
      this.#revertResourceChange(kind, entityId);
    } else {
      throw new Error(`Unsupported SCM domain: ${domain}`);
    }

    this.#persistAndEmit();
    return this.#currentScmSnapshot();
  }

  commitScm(message: string, author: { name: string; email: string }): ScmSnapshot {
    const tree = this.#writeCurrentTreeToRepo();
    const parentCommit = this.#repo.readBranch(this.#branchName);
    const parents: SHA1[] = parentCommit !== null ? [parentCommit] : [];
    const now = Math.floor(Date.now() / 1000);
    const gitAuthor = { name: author.name, email: author.email, timestamp: now, timezone: "+0000" };
    const commitHash = this.#repo.createCommit(tree, parents, message, gitAuthor);

    this.#repo.updateRef(`refs/heads/${this.#branchName}`, commitHash);
    this.#baseCommitSha = commitHash;
    this.#baseManuscriptTree = cloneManuscriptTreeSnapshot(this.#manuscriptTree);
    this.#baseResourceTree = cloneResourceTreeSnapshot(this.#resourceTree);
    this.#baseManuscript = cloneManuscriptSnapshotState(this.#currentManuscript);
    this.#baseResources = cloneResourceSnapshotState(this.#currentResources);
    this.#persistAndEmit(true);
    return this.#currentScmSnapshot();
  }

  listBranchCommits(maxCount = 50): ScmCommitSummary[] {
    const tip = this.#repo.readBranch(this.#branchName);
    if (tip === null) {
      return [];
    }

    const commits: ScmCommitSummary[] = [];
    for (const entry of walkLogEntries(this.#objects, { from: [tip], maxCount })) {
      const subject = entry.commit.message.split("\n")[0]?.trim() ?? "";
      commits.push({
        hash: entry.hash,
        shortHash: entry.hash.slice(0, 7),
        message: subject === "" ? "(无提交说明)" : subject,
        authorName: entry.commit.author.name,
        committedAt: entry.commit.committer.timestamp,
      });
    }
    return commits;
  }

  searchWorktree(options: WorktreeSearchQuery): WorktreeSearchResult {
    return executeWorktreeSearch(
      this.#currentManuscript.entries.values(),
      this.#currentResources.entries.values(),
      options,
    );
  }

  #loadOrSeed(): void {
    const record = this.#store.getWorktree(this.#projectId, this.#branchName);
    if (record === null) {
      this.#seedFromBaseCommit(this.#repo.readBranch(this.#branchName));
      return;
    }

    this.#baseCommitSha = record.baseCommitSha as SHA1 | null;
    this.#revision = record.revision;
    this.#warning = record.warning;

    try {
      this.#loadFromStore(record);
    } catch (error) {
      this.#seedFromBaseCommit(
        record.baseCommitSha as SHA1 | null,
        error instanceof Error
          ? `检测到损坏草稿，已按分支基线重建：${error.message}`
          : "检测到损坏草稿，已按分支基线重建。",
      );
    }
  }

  #loadFromStore(record: WorktreeRecord): void {
    const manuscriptCurrentRows = this.#store.readManuscriptCurrentRows(
      record.projectId,
      record.branchName,
    );
    const manuscriptCommittedRows = this.#store.readManuscriptCommittedRows(
      record.projectId,
      record.branchName,
    );
    const resourceCurrentRows = this.#store.readResourceCurrentRows(
      record.projectId,
      record.branchName,
    );
    const resourceCommittedRows = this.#store.readResourceCommittedRows(
      record.projectId,
      record.branchName,
    );

    this.#manuscriptTree = buildManuscriptTreeFromCurrentRows(manuscriptCurrentRows);
    this.#baseManuscriptTree = buildManuscriptTreeFromCommittedRows(manuscriptCommittedRows);
    this.#resourceTree = buildResourceTreeFromCurrentRows(resourceCurrentRows);
    this.#baseResourceTree = buildResourceTreeFromCommittedRows(resourceCommittedRows);

    const currentManuscriptContent = new Map(
      manuscriptCurrentRows
        .filter((row) => row.type === "chapter")
        .map((row) => [row.id, row.content?.toString("utf-8") ?? ""] as const),
    );
    const currentResourceContent = new Map(
      resourceCurrentRows
        .filter((row) => row.type === "file")
        .map((row) => [row.id, row.content?.toString("utf-8") ?? ""] as const),
    );

    this.#currentManuscript = buildManuscriptSnapshot(
      manuscriptTreeToOutline(this.#manuscriptTree),
      (id) => currentManuscriptContent.get(id) ?? "",
    );
    const currentResourceState = buildResourceSnapshotFromTree(
      this.#resourceTree,
      (id) => currentResourceContent.get(id) ?? "",
    );
    this.#currentResources = currentResourceState.snapshot;
    this.#resourcePathById.clear();
    this.#resourceIdByPath.clear();
    for (const [id, path] of currentResourceState.pathById.entries()) {
      this.#resourcePathById.set(id, path);
    }
    for (const [path, id] of currentResourceState.idByPath.entries()) {
      this.#resourceIdByPath.set(path, id);
    }

    this.#baseManuscript = this.#buildBaseManuscriptStateFromCommittedRows(manuscriptCommittedRows);
    this.#baseResources = this.#buildBaseResourceStateFromCommittedRows(resourceCommittedRows);
    this.#recomputeAllChangeStatuses();
  }

  #seedFromBaseCommit(baseCommitSha: SHA1 | null, warning: string | null = null): void {
    this.#baseCommitSha = baseCommitSha;
    this.#warning = warning;
    this.#revision = warning === null ? 0 : this.#revision + 1;

    if (baseCommitSha === null) {
      const outline = createEmptyOutline();
      this.#manuscriptTree = manuscriptTreeFromOutline(outline);
      this.#baseManuscriptTree = cloneManuscriptTreeSnapshot(this.#manuscriptTree);
      this.#currentManuscript = buildManuscriptSnapshot(outline, () => "");
      this.#baseManuscript = cloneManuscriptSnapshotState(this.#currentManuscript);
      this.#resourceTree = {
        rootId: RESOURCE_ROOT_ID,
        nodes: {
          [RESOURCE_ROOT_ID]: {
            id: RESOURCE_ROOT_ID,
            type: "folder",
            name: "",
            parentId: null,
            childIds: [],
          },
        },
      };
      this.#baseResourceTree = cloneResourceTreeSnapshot(this.#resourceTree);
      this.#currentResources = { entries: new Map() };
      this.#baseResources = { entries: new Map() };
      this.#resourcePathById.clear();
      this.#resourcePathById.set(RESOURCE_ROOT_ID, "");
      this.#resourceIdByPath.clear();
      this.#resourceIdByPath.set("", RESOURCE_ROOT_ID);
      this.#persistState(true);
      return;
    }

    const baseManuscript = buildBaseManuscriptSnapshot(this.#objects, this.#resolveBaseTree());
    const seededResources = this.#seedResourcesFromBaseTree(this.#resolveBaseTree());

    this.#baseManuscript = baseManuscript;
    this.#currentManuscript = cloneManuscriptSnapshotState(baseManuscript);
    this.#manuscriptTree = manuscriptTreeFromOutline(baseManuscript.outline);
    this.#baseManuscriptTree = cloneManuscriptTreeSnapshot(this.#manuscriptTree);
    this.#baseResources = cloneResourceSnapshotState(seededResources.snapshot);
    this.#currentResources = cloneResourceSnapshotState(seededResources.snapshot);
    this.#resourceTree = cloneResourceTreeSnapshot(seededResources.tree);
    this.#baseResourceTree = cloneResourceTreeSnapshot(seededResources.tree);
    this.#resourcePathById.clear();
    this.#resourceIdByPath.clear();
    for (const [id, path] of seededResources.pathById.entries()) {
      this.#resourcePathById.set(id, path);
    }
    for (const [path, id] of seededResources.idByPath.entries()) {
      this.#resourceIdByPath.set(path, id);
    }
    this.#persistState(true);
  }

  #seedResourcesFromBaseTree(baseTree: SHA1): {
    tree: ResourceTreeSnapshot;
    snapshot: ResourceSnapshotState;
    pathById: Map<string, string>;
    idByPath: Map<string, string>;
  } {
    const legacy = buildBaseResourceSnapshot(this.#objects, baseTree);
    const tree: ResourceTreeSnapshot = {
      rootId: RESOURCE_ROOT_ID,
      nodes: {
        [RESOURCE_ROOT_ID]: {
          id: RESOURCE_ROOT_ID,
          type: "folder",
          name: "",
          parentId: null,
          childIds: [],
        },
      },
    };
    const snapshotEntries = new Map<string, ResourceSnapshotEntry>();
    const pathById = new Map<string, string>([[RESOURCE_ROOT_ID, ""]]);
    const idByPath = new Map<string, string>([["", RESOURCE_ROOT_ID]]);

    for (const legacyEntry of sortedEntryValues(legacy.entries)) {
      const parentId = idByPath.get(legacyEntry.parentPath);
      if (parentId === undefined) {
        throw new Error(`Missing seeded resource parent: ${legacyEntry.parentPath}`);
      }
      const id = this.#createResourceId();
      tree.nodes[id] = {
        id,
        type: legacyEntry.type,
        name: legacyEntry.name,
        parentId,
        childIds: [],
      };
      tree.nodes[parentId]!.childIds.push(id);
      pathById.set(id, legacyEntry.path);
      idByPath.set(legacyEntry.path, id);
      snapshotEntries.set(id, {
        id,
        type: legacyEntry.type,
        name: legacyEntry.name,
        parentId,
        index: tree.nodes[parentId]!.childIds.length - 1,
        depth: legacyEntry.depth,
        displayPath: legacyEntry.displayPath,
        order: legacyEntry.order,
        content: legacyEntry.content,
      });
    }

    return {
      tree,
      snapshot: { entries: snapshotEntries },
      pathById,
      idByPath,
    };
  }

  #buildBaseManuscriptStateFromCommittedRows(
    _rows: readonly ManuscriptNodeCommittedRow[],
  ): ManuscriptSnapshotState {
    const tree = this.#baseManuscriptTree;
    const outline = manuscriptTreeToOutline(tree);
    const baseTree = this.#resolveBaseTree();
    return buildManuscriptSnapshot(
      outline,
      (id) => readTextFromTree(this.#objects, baseTree, chapterBodyPath(id)) ?? "",
    );
  }

  #buildBaseResourceStateFromCommittedRows(
    _rows: readonly ResourceNodeCommittedRow[],
  ): ResourceSnapshotState {
    const baseTree = this.#resolveBaseTree();
    return buildResourceSnapshotFromTree(this.#baseResourceTree, (id) => {
      const path = this.#buildResourcePathFromTree(this.#baseResourceTree, id);
      return readTextFromTree(this.#objects, baseTree, `${RESOURCES_DIR}/${path}`) ?? "";
    }).snapshot;
  }

  #buildResourcePathFromTree(tree: ResourceTreeSnapshot, id: string): string {
    if (id === tree.rootId) {
      return "";
    }
    const segments: string[] = [];
    let currentId: string | null = id;
    while (currentId !== null && currentId !== tree.rootId) {
      const node: ResourceTreeNode | undefined = tree.nodes[currentId];
      if (node === undefined) {
        throw new Error(`Missing resource node while resolving path: ${id}`);
      }
      segments.push(node.name);
      currentId = node.parentId;
    }
    return segments.reverse().join("/");
  }

  #persistAndEmit(includeCommitted = false): void {
    this.#warning = null;
    this.#recomputeAllChangeStatuses();
    this.#revision += 1;
    this.#persistState(includeCommitted);
    this.#treePublisher.emit({
      kind: "snapshot",
      snapshot: buildWorktreeTreeSnapshot(this.#revision, this.#manuscriptTree, this.#resourceTree),
    });
    this.#scmPublisher.emit(this.#currentScmSnapshot());
  }

  #persistState(includeCommitted: boolean): void {
    this.#store.transaction(() => {
      this.#store.upsertWorktree({
        projectId: this.#projectId,
        branchName: this.#branchName,
        baseCommitSha: this.#baseCommitSha,
        revision: this.#revision,
        warning: this.#warning,
      });
      this.#store.replaceManuscriptCurrentRows(
        this.#projectId,
        this.#branchName,
        this.#serializeCurrentManuscriptRows(),
      );
      this.#store.replaceResourceCurrentRows(
        this.#projectId,
        this.#branchName,
        this.#serializeCurrentResourceRows(),
      );
      if (includeCommitted) {
        this.#store.replaceManuscriptCommittedRows(
          this.#projectId,
          this.#branchName,
          this.#serializeCommittedManuscriptRows(),
        );
        this.#store.replaceResourceCommittedRows(
          this.#projectId,
          this.#branchName,
          this.#serializeCommittedResourceRows(),
        );
      }
    });
  }

  #serializeCurrentManuscriptRows(): ManuscriptNodeCurrentRow[] {
    const rows: ManuscriptNodeCurrentRow[] = [];
    const visit = (id: string): void => {
      const node = this.#manuscriptTree.nodes[id];
      if (node === undefined) {
        return;
      }
      const parent = node.parentId;
      const sortIndex =
        parent === null ? 0 : (this.#manuscriptTree.nodes[parent]?.childIds.indexOf(id) ?? 0);
      rows.push({
        projectId: this.#projectId,
        branchName: this.#branchName,
        id,
        parentId: parent,
        type: node.type,
        title: node.title,
        sortIndex,
        content:
          node.type === "chapter"
            ? Buffer.from(this.#currentManuscript.entries.get(id)?.content ?? "", "utf-8")
            : null,
      });
      if (node.type === "folder") {
        node.childIds.forEach(visit);
      }
    };
    visit(this.#manuscriptTree.rootId);
    return rows;
  }

  #serializeCommittedManuscriptRows(): ManuscriptNodeCommittedRow[] {
    const rows: ManuscriptNodeCommittedRow[] = [];
    const visit = (id: string): void => {
      const node = this.#baseManuscriptTree.nodes[id];
      if (node === undefined) {
        return;
      }
      const parent = node.parentId;
      const sortIndex =
        parent === null ? 0 : (this.#baseManuscriptTree.nodes[parent]?.childIds.indexOf(id) ?? 0);
      rows.push({
        projectId: this.#projectId,
        branchName: this.#branchName,
        id,
        parentId: parent,
        type: node.type,
        title: node.title,
        sortIndex,
        contentSha:
          node.type === "chapter"
            ? this.#repo.hashObject(
                Buffer.from(this.#baseManuscript.entries.get(id)?.content ?? "", "utf-8"),
              )
            : null,
      });
      if (node.type === "folder") {
        node.childIds.forEach(visit);
      }
    };
    visit(this.#baseManuscriptTree.rootId);
    return rows;
  }

  #serializeCurrentResourceRows(): ResourceNodeCurrentRow[] {
    const rows: ResourceNodeCurrentRow[] = [];
    const visit = (id: string): void => {
      const node = this.#resourceTree.nodes[id];
      if (node === undefined) {
        return;
      }
      const parent = node.parentId;
      rows.push({
        projectId: this.#projectId,
        branchName: this.#branchName,
        id,
        parentId: parent,
        type: node.type,
        name: node.name,
        content:
          node.type === "file"
            ? Buffer.from(this.#currentResources.entries.get(id)?.content ?? "", "utf-8")
            : null,
      });
      if (node.type === "folder") {
        node.childIds.forEach(visit);
      }
    };
    visit(this.#resourceTree.rootId);
    return rows;
  }

  #serializeCommittedResourceRows(): ResourceNodeCommittedRow[] {
    const rows: ResourceNodeCommittedRow[] = [];
    const visit = (id: string): void => {
      const node = this.#baseResourceTree.nodes[id];
      if (node === undefined) {
        return;
      }
      const parent = node.parentId;
      rows.push({
        projectId: this.#projectId,
        branchName: this.#branchName,
        id,
        parentId: parent,
        type: node.type,
        name: node.name,
        contentSha:
          node.type === "file"
            ? this.#repo.hashObject(
                Buffer.from(this.#baseResources.entries.get(id)?.content ?? "", "utf-8"),
              )
            : null,
      });
      if (node.type === "folder") {
        node.childIds.forEach(visit);
      }
    };
    visit(this.#baseResourceTree.rootId);
    return rows;
  }

  #rebuildCurrentManuscriptFromTree(contentOverrides?: ReadonlyMap<string, string>): void {
    const previousContent = new Map(
      [...this.#currentManuscript.entries.entries()].map(
        ([id, entry]) => [id, entry.content] as const,
      ),
    );
    for (const [id, content] of contentOverrides ?? []) {
      previousContent.set(id, content);
    }
    this.#currentManuscript = buildManuscriptSnapshot(
      manuscriptTreeToOutline(this.#manuscriptTree),
      (id) => previousContent.get(id) ?? "",
    );
  }

  #rebuildCurrentResourcesFromTree(contentOverrides?: ReadonlyMap<string, string>): void {
    const previousContent = new Map(
      [...this.#currentResources.entries.entries()].map(
        ([id, entry]) => [id, entry.content] as const,
      ),
    );
    for (const [id, content] of contentOverrides ?? []) {
      previousContent.set(id, content);
    }
    const rebuilt = buildResourceSnapshotFromTree(
      this.#resourceTree,
      (id) => previousContent.get(id) ?? "",
    );
    this.#currentResources = rebuilt.snapshot;
    this.#resourcePathById.clear();
    this.#resourceIdByPath.clear();
    for (const [id, path] of rebuilt.pathById.entries()) {
      this.#resourcePathById.set(id, path);
    }
    for (const [path, id] of rebuilt.idByPath.entries()) {
      this.#resourceIdByPath.set(path, id);
    }
  }

  #recomputeAllChangeStatuses(): void {
    clearChangeStatuses(this.#manuscriptTree.nodes);
    clearChangeStatuses(this.#resourceTree.nodes);
    const reorderedManuscriptIds = computeMinimalReorderedManuscriptIds(
      this.#baseManuscript,
      this.#currentManuscript,
    );

    for (const [id, entry] of this.#currentManuscript.entries.entries()) {
      const node = this.#manuscriptTree.nodes[id];
      if (node === undefined) {
        continue;
      }
      const baseEntry = this.#baseManuscript.entries.get(id);
      node.changeStatus = this.#resolveManuscriptChangeStatus(
        entry,
        baseEntry,
        reorderedManuscriptIds.has(id),
      );
    }
    refreshAllFolderChangeStatuses(this.#manuscriptTree);

    for (const [id, entry] of this.#currentResources.entries.entries()) {
      const node = this.#resourceTree.nodes[id];
      if (node === undefined) {
        continue;
      }
      const baseEntry = this.#baseResources.entries.get(id);
      node.changeStatus = this.#resolveResourceChangeStatus(entry, baseEntry);
    }
    refreshAllFolderChangeStatuses(this.#resourceTree);
  }

  #resolveManuscriptChangeStatus(
    current: ManuscriptEntry,
    base: ManuscriptEntry | undefined,
    reordered: boolean,
  ): FileChangeStatus | undefined {
    if (base === undefined) {
      return "added";
    }
    if (
      current.title !== base.title ||
      current.parentId !== base.parentId ||
      reordered ||
      (current.type === "chapter" && current.content !== base.content)
    ) {
      return "modified";
    }
    return undefined;
  }

  #resolveResourceChangeStatus(
    current: ResourceSnapshotEntry,
    base: ResourceSnapshotEntry | undefined,
  ): FileChangeStatus | undefined {
    if (base === undefined) {
      return "added";
    }
    if (
      current.name !== base.name ||
      current.parentId !== base.parentId ||
      (current.type === "file" && current.content !== base.content)
    ) {
      return "modified";
    }
    return undefined;
  }

  #revertManuscriptChange(kind: string, id: string): void {
    switch (kind) {
      case "create":
        this.#deleteManuscriptNodeFromCurrent(id);
        return;
      case "delete":
        this.#restoreManuscriptSubtreeFromBase(id);
        return;
      case "rename":
        this.#renameManuscriptToBase(id);
        return;
      case "move":
      case "reorder":
        this.#moveManuscriptToBase(id);
        return;
      case "content":
        this.#restoreManuscriptContentFromBase(id);
        return;
      default:
        throw new Error(`Unsupported manuscript change kind: ${kind}`);
    }
  }

  #revertResourceChange(kind: string, id: string): void {
    switch (kind) {
      case "create":
        this.#deleteResourceNodeFromCurrent(id);
        return;
      case "delete":
        this.#restoreResourceSubtreeFromBase(id);
        return;
      case "rename":
        this.#renameResourceToBase(id);
        return;
      case "move":
        this.#moveResourceToBase(id);
        return;
      case "content":
        this.#restoreResourceContentFromBase(id);
        return;
      default:
        throw new Error(`Unsupported resource change kind: ${kind}`);
    }
  }

  #restoreManuscriptSubtreeFromBase(id: string): void {
    if (this.#currentManuscript.entries.has(id)) {
      return;
    }
    this.#ensureCurrentManuscriptAncestorExists(
      this.#baseManuscript.entries.get(id)?.parentId ?? null,
    );
    const contentById = new Map<string, string>();
    const cloneSubtree = (nodeId: string): void => {
      const baseNode = this.#baseManuscriptTree.nodes[nodeId];
      if (baseNode === undefined) {
        throw new Error(`Base manuscript node does not exist: ${nodeId}`);
      }
      this.#manuscriptTree.nodes[nodeId] = cloneManuscriptTreeNode(baseNode);
      if (baseNode.type === "chapter") {
        contentById.set(nodeId, this.#baseManuscript.entries.get(nodeId)?.content ?? "");
      }
      if (baseNode.type === "folder") {
        baseNode.childIds.forEach(cloneSubtree);
      }
    };
    cloneSubtree(id);
    const parentId = this.#baseManuscript.entries.get(id)?.parentId ?? MANUSCRIPT_ROOT_ID;
    const parent = this.#requireManuscriptFolder(parentId);
    const baseIndex = this.#baseManuscript.entries.get(id)?.index ?? parent.childIds.length;
    if (!parent.childIds.includes(id)) {
      parent.childIds.splice(clampChildIndex(baseIndex, parent.childIds.length), 0, id);
    }
    this.#rebuildCurrentManuscriptFromTree(contentById);
  }

  #ensureCurrentManuscriptAncestorExists(parentId: string | null): void {
    if (parentId === null || parentId === MANUSCRIPT_ROOT_ID) {
      return;
    }
    if (this.#manuscriptTree.nodes[parentId] !== undefined) {
      return;
    }
    this.#restoreManuscriptSubtreeFromBase(parentId);
  }

  #renameManuscriptToBase(id: string): void {
    const node = this.#requireManuscriptNode(id);
    const baseNode = this.#baseManuscriptTree.nodes[id];
    if (baseNode === undefined) {
      throw new Error(`Base manuscript node does not exist: ${id}`);
    }
    node.title = baseNode.title;
    this.#rebuildCurrentManuscriptFromTree();
  }

  #moveManuscriptToBase(id: string): void {
    const entry = this.#baseManuscript.entries.get(id);
    if (entry === undefined) {
      throw new Error(`Base manuscript node does not exist: ${id}`);
    }
    this.#ensureCurrentManuscriptAncestorExists(entry.parentId);
    const node = this.#requireManuscriptNode(id);
    const sourceParent = this.#requireManuscriptFolder(node.parentId ?? "");
    sourceParent.childIds = sourceParent.childIds.filter((childId) => childId !== id);
    const targetParent = this.#requireManuscriptFolder(entry.parentId);
    targetParent.childIds.splice(clampChildIndex(entry.index, targetParent.childIds.length), 0, id);
    node.parentId = targetParent.id;
    this.#rebuildCurrentManuscriptFromTree();
  }

  #restoreManuscriptContentFromBase(id: string): void {
    const entry = this.#currentManuscript.entries.get(id);
    const baseEntry = this.#baseManuscript.entries.get(id);
    if (entry === undefined || baseEntry === undefined) {
      throw new Error(`Manuscript chapter does not exist in base/current: ${id}`);
    }
    entry.content = baseEntry.content;
  }

  #restoreResourceSubtreeFromBase(id: string): void {
    if (this.#currentResources.entries.has(id)) {
      return;
    }
    this.#ensureCurrentResourceAncestorExists(
      this.#baseResources.entries.get(id)?.parentId ?? null,
    );
    const contentById = new Map<string, string>();
    const cloneSubtree = (nodeId: string): void => {
      const baseNode = this.#baseResourceTree.nodes[nodeId];
      if (baseNode === undefined) {
        throw new Error(`Base resource node does not exist: ${nodeId}`);
      }
      this.#resourceTree.nodes[nodeId] = cloneResourceTreeNode(baseNode);
      if (baseNode.type === "file") {
        contentById.set(nodeId, this.#baseResources.entries.get(nodeId)?.content ?? "");
      }
      if (baseNode.type === "folder") {
        baseNode.childIds.forEach(cloneSubtree);
      }
    };
    cloneSubtree(id);
    const parentId = this.#baseResources.entries.get(id)?.parentId ?? RESOURCE_ROOT_ID;
    const parent = this.#requireResourceFolder(parentId);
    const baseIndex = this.#baseResources.entries.get(id)?.index ?? parent.childIds.length;
    if (!parent.childIds.includes(id)) {
      parent.childIds.splice(clampChildIndex(baseIndex, parent.childIds.length), 0, id);
    }
    this.#rebuildCurrentResourcesFromTree(contentById);
  }

  #ensureCurrentResourceAncestorExists(parentId: string | null): void {
    if (parentId === null || parentId === RESOURCE_ROOT_ID) {
      return;
    }
    if (this.#resourceTree.nodes[parentId] !== undefined) {
      return;
    }
    this.#restoreResourceSubtreeFromBase(parentId);
  }

  #renameResourceToBase(id: string): void {
    const node = this.#requireResourceNode(id);
    const baseNode = this.#baseResourceTree.nodes[id];
    if (baseNode === undefined) {
      throw new Error(`Base resource node does not exist: ${id}`);
    }
    node.name = baseNode.name;
    const parentId = node.parentId;
    if (parentId !== null) {
      sortResourceChildrenByName(this.#resourceTree, parentId);
    }
    this.#rebuildCurrentResourcesFromTree();
  }

  #moveResourceToBase(id: string): void {
    const entry = this.#baseResources.entries.get(id);
    if (entry === undefined) {
      throw new Error(`Base resource node does not exist: ${id}`);
    }
    this.#ensureCurrentResourceAncestorExists(entry.parentId);
    const node = this.#requireResourceNode(id);
    const sourceParent = this.#requireResourceFolder(node.parentId ?? "");
    sourceParent.childIds = sourceParent.childIds.filter((childId) => childId !== id);
    const targetParent = this.#requireResourceFolder(entry.parentId);
    targetParent.childIds.splice(clampChildIndex(entry.index, targetParent.childIds.length), 0, id);
    node.parentId = targetParent.id;
    this.#rebuildCurrentResourcesFromTree();
  }

  #restoreResourceContentFromBase(id: string): void {
    const entry = this.#currentResources.entries.get(id);
    const baseEntry = this.#baseResources.entries.get(id);
    if (entry === undefined || baseEntry === undefined) {
      throw new Error(`Resource file does not exist in base/current: ${id}`);
    }
    entry.content = baseEntry.content;
  }

  #writeCurrentTreeToRepo(): SHA1 {
    const rootEntries = [];
    rootEntries.push({
      mode: "040000",
      name: "manuscript",
      hash: this.#writeCurrentManuscriptTreeToRepo(),
    });
    const resourcesTree = this.#writeCurrentResourcesTreeToRepo(this.#resourceTree.rootId);
    if (resourcesTree !== null) {
      rootEntries.push({
        mode: "040000",
        name: RESOURCES_DIR,
        hash: resourcesTree,
      });
    }
    return this.#repo.createTree(rootEntries);
  }

  #writeCurrentManuscriptTreeToRepo(): SHA1 {
    const outline = `${JSON.stringify(manuscriptTreeToOutline(this.#manuscriptTree), null, 2)}\n`;
    const entries = [
      {
        mode: "100644",
        name: "outline.json",
        hash: this.#repo.writeBlob(Buffer.from(outline, "utf-8")),
      },
    ];

    const chapterEntries = sortedEntryValues(this.#currentManuscript.entries)
      .filter((entry) => entry.type === "chapter")
      .map((entry) => ({
        mode: "100644",
        name: `${entry.id}.md`,
        hash: this.#repo.writeBlob(Buffer.from(entry.content, "utf-8")),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    if (chapterEntries.length > 0) {
      entries.push({
        mode: "040000",
        name: "bodies",
        hash: this.#repo.createTree(chapterEntries),
      });
    }

    return this.#repo.createTree(entries);
  }

  #writeCurrentResourcesTreeToRepo(folderId: string): SHA1 | null {
    const folder = this.#resourceTree.nodes[folderId];
    if (folder === undefined || folder.type !== "folder") {
      return null;
    }

    const entries = folder.childIds
      .map((childId) => {
        const child = this.#resourceTree.nodes[childId];
        if (child === undefined) {
          return null;
        }
        if (child.type === "file") {
          return {
            mode: "100644",
            name: child.name,
            hash: this.#repo.writeBlob(
              Buffer.from(this.#currentResources.entries.get(child.id)?.content ?? "", "utf-8"),
            ),
          };
        }
        const subtree = this.#writeCurrentResourcesTreeToRepo(child.id);
        return subtree === null
          ? null
          : {
              mode: "040000",
              name: child.name,
              hash: subtree,
            };
      })
      .filter((entry) => entry !== null)
      .sort((left, right) => left.name.localeCompare(right.name));

    if (entries.length === 0) {
      return null;
    }
    return this.#repo.createTree(entries);
  }

  #currentScmSnapshot(): ScmSnapshot {
    return buildDetailedScmSnapshot({
      revision: this.#revision,
      baseTree: this.baseTree,
      warning: this.#warning,
      baseManuscript: this.#baseManuscript,
      currentManuscript: this.#currentManuscript,
      baseResources: this.#baseResources,
      currentResources: this.#currentResources,
    });
  }

  #resolveBaseTree(): SHA1 {
    if (this.#baseCommitSha === null) {
      return this.#repo.createTree([]);
    }
    const object = this.#repo.catFile(this.#baseCommitSha);
    if (object.type !== "commit") {
      throw new Error(`Expected commit at ${this.#baseCommitSha}, got ${object.type}.`);
    }
    return object.tree;
  }

  #requireManuscriptNode(id: string): ManuscriptTreeNode {
    const node = this.#manuscriptTree.nodes[id];
    if (node === undefined) {
      throw new Error(`Manuscript node does not exist: ${id}`);
    }
    return node;
  }

  #requireManuscriptFolder(id: string): ManuscriptTreeNode & { type: "folder" } {
    const node = this.#requireManuscriptNode(id);
    if (node.type !== "folder") {
      throw new Error(`Manuscript node is not a folder: ${id}`);
    }
    return node as ManuscriptTreeNode & { type: "folder" };
  }

  #requireResourceNode(id: string): ResourceTreeNode {
    const node = this.#resourceTree.nodes[id];
    if (node === undefined) {
      throw new Error(`Resource node does not exist: ${id}`);
    }
    return node;
  }

  #requireResourceFolder(id: string): ResourceTreeNode & { type: "folder" } {
    const node = this.#requireResourceNode(id);
    if (node.type !== "folder") {
      throw new Error(`Resource node is not a folder: ${id}`);
    }
    return node as ResourceTreeNode & { type: "folder" };
  }

  #isManuscriptDescendant(ancestorId: string, candidateId: string): boolean {
    let currentId: string | null | undefined = candidateId;
    while (currentId !== null && currentId !== undefined) {
      if (currentId === ancestorId) {
        return true;
      }
      currentId = this.#manuscriptTree.nodes[currentId]?.parentId;
    }
    return false;
  }

  #isResourceDescendant(ancestorId: string, candidateId: string): boolean {
    let currentId: string | null | undefined = candidateId;
    while (currentId !== null && currentId !== undefined) {
      if (currentId === ancestorId) {
        return true;
      }
      currentId = this.#resourceTree.nodes[currentId]?.parentId;
    }
    return false;
  }

  #collectManuscriptSubtreeIds(id: string): string[] {
    const ids: string[] = [];
    const visit = (nodeId: string): void => {
      ids.push(nodeId);
      const node = this.#manuscriptTree.nodes[nodeId];
      if (node?.type === "folder") {
        node.childIds.forEach(visit);
      }
    };
    visit(id);
    return ids;
  }

  #collectResourceSubtreeIds(id: string): string[] {
    const ids: string[] = [];
    const visit = (nodeId: string): void => {
      ids.push(nodeId);
      const node = this.#resourceTree.nodes[nodeId];
      if (node?.type === "folder") {
        node.childIds.forEach(visit);
      }
    };
    visit(id);
    return ids;
  }

  #assertResourceSiblingNameAvailable(parentId: string, name: string, excludeId?: string): void {
    const parent = this.#requireResourceFolder(parentId);
    for (const childId of parent.childIds) {
      if (childId === excludeId) {
        continue;
      }
      const child = this.#resourceTree.nodes[childId];
      if (child?.name === name) {
        throw new Error(`Resource name already exists: ${name}`);
      }
    }
  }

  #createUniqueManuscriptId(): string {
    let id = nanoid(MANUSCRIPT_ID_SIZE);
    while (
      this.#manuscriptTree?.nodes[id] !== undefined ||
      this.#baseManuscriptTree?.nodes[id] !== undefined
    ) {
      id = nanoid(MANUSCRIPT_ID_SIZE);
    }
    return id;
  }

  #createResourceId(): string {
    let id = `res_${nanoid(RESOURCE_ID_SIZE)}`;
    while (
      this.#resourceTree?.nodes[id] !== undefined ||
      this.#baseResourceTree?.nodes[id] !== undefined
    ) {
      id = `res_${nanoid(RESOURCE_ID_SIZE)}`;
    }
    return id;
  }
}
