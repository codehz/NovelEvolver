import type { SHA1 } from "nano-git";
import { walkLogEntries } from "nano-git/log";
import type { Repository } from "nano-git/repository/core";
import { nanoid } from "nanoid";

import type {
  CommitSummary,
  HistoryEntry,
  HistoryEntryContent,
  HistoryTarget,
} from "#shared/rpc/history-rpc";
import type { WorktreeNodeIdResult } from "#shared/rpc/manuscript-rpc";
import type {
  Change,
  ChangeTextComparison,
  ChangeTextComparisonTarget,
  ChangesEvent,
  ChangesTreeDelta,
  ChangesSnapshot,
} from "#shared/rpc/worktree-changes-rpc";
import type { WorktreeSearchQuery, WorktreeSearchResult } from "#shared/rpc/worktree-search-rpc";
import type {
  FileChangeStatus,
  ManuscriptTreeNode,
  ManuscriptTreeSnapshot,
  ResourceTreeNode,
  ResourceTreeSnapshot,
} from "#shared/rpc/worktree-tree-rpc";

import type {
  ManuscriptNodeCommittedRow,
  ManuscriptNodeCurrentRow,
  ResourceNodeCommittedRow,
  ResourceNodeCurrentRow,
  WorktreeJournalEntryRecord,
  WorktreeJournalSource,
  WorktreeRecord,
  WorktreeRepository,
} from "../db/repositories/worktree-repo";
import {
  clampChildIndex,
  createEmptyOutline,
  MANUSCRIPT_ROOT_ID,
  normalizeManuscriptTitle,
} from "../manuscript-outline";
import { chapterBodyPath } from "../manuscript-path";
import { RESOURCES_DIR } from "../resource-library-path";
import { RpcStreamPublisher } from "../rpc/stream-publisher";
import { executeWorktreeSearch } from "../search/worktree-search";
import { refreshAllFolderChangeStatuses } from "./change-status";
import { ChangeTracker } from "./change-tracker";
import { computeStats, readTextFromTree, type ObjectDatabase } from "./diff-utils";
import { buildJournalChangesSnapshot } from "./journal-pending-projector";
import type {
  JournalEntitySnapshot,
  JournalOperationCapture,
  JournalRevisionCapture,
} from "./journal-types";
import { journalHistoryEntryId, parseJournalHistoryEntryId, sha1Text } from "./journal-types";
import { computeMinimalReorderedManuscriptIds } from "./manuscript-reorder";
import {
  parseResourceIndex,
  RESOURCE_ROOT_ID,
  resourceIndexFromTree,
  resourceTreeFromIndex,
} from "./resource-index";
import type { ResourceSnapshotEntry, ResourceSnapshotState } from "./resource-snapshot-state";
import {
  buildBaseManuscriptSnapshot,
  buildManuscriptSnapshot,
  type ManuscriptEntry,
  type ManuscriptSnapshotState,
} from "./snapshot-state";
import {
  cloneManuscriptSnapshotState,
  cloneManuscriptTreeNode,
  cloneManuscriptTreeSnapshot,
  cloneResourceSnapshotState,
  cloneResourceTreeNode,
  cloneResourceTreeSnapshot,
} from "./tree-clone";
import {
  computeManuscriptTreeDelta,
  computeResourceTreeDelta,
  isEmptyManuscriptTreeDelta,
  isEmptyResourceTreeDelta,
} from "./tree-delta";
import {
  buildManuscriptTreeFromCommittedRows,
  buildManuscriptTreeFromCurrentRows,
  buildResourceTreeFromCommittedRows,
  buildResourceTreeFromCurrentRows,
} from "./tree-from-rows";
import {
  buildResourceSnapshotFromTree,
  clearChangeStatuses,
  manuscriptTreeFromOutline,
  manuscriptTreeToOutline,
  normalizeResourceNodeName,
  sortResourceChildrenByName,
  sortedEntryValues,
} from "./worktree-tree-bridge";

const MANUSCRIPT_ID_SIZE = 10;
const RESOURCE_ID_SIZE = 10;
const RESOURCES_INDEX_FILE = "index.json";
const RESOURCES_FILES_DIR_NAME = "files";
const RESOURCES_INDEX_PATH = `${RESOURCES_DIR}/${RESOURCES_INDEX_FILE}`;
const RESOURCES_FILES_DIR = `${RESOURCES_DIR}/${RESOURCES_FILES_DIR_NAME}`;
const AUTOSAVE_JOURNAL_MERGE_WINDOW_MS = 5 * 60 * 1000;
const RESTORE_HUNK_JOURNAL_MERGE_WINDOW_MS = 5 * 60 * 1000;

export class WorktreeSession {
  readonly #store: WorktreeRepository;
  readonly #objects: ObjectDatabase;
  readonly #repo: Repository;
  readonly #projectId: number;
  readonly #branchName: string;
  readonly #changesPublisher = new RpcStreamPublisher<ChangesEvent>();
  readonly #changeTracker = new ChangeTracker();

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
  #lastPublishedManuscriptTree: ManuscriptTreeSnapshot | null = null;
  #lastPublishedResourceTree: ResourceTreeSnapshot | null = null;

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

  subscribeChanges(): ReadableStream<ChangesEvent> {
    return this.#changesPublisher.subscribe({
      getInitialValue: () => this.#currentChangesSnapshot(),
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
    const entry = this.#requireManuscriptJournalEntry(nodeId);
    this.#persistAndEmit(false, {
      source: "structure-edit",
      title: "创建文件夹",
      groupKey: null,
      operations: [
        {
          kind: "create",
          domain: "manuscript",
          entityId: nodeId,
          entityKind: "folder",
          label: entry.title,
          displayPath: entry.displayPath,
        },
      ],
    });
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
    const entry = this.#requireManuscriptJournalEntry(nodeId);
    this.#persistAndEmit(false, {
      source: "structure-edit",
      title: "创建章节",
      groupKey: null,
      operations: [
        {
          kind: "create",
          domain: "manuscript",
          entityId: nodeId,
          entityKind: "chapter",
          label: entry.title,
          displayPath: entry.displayPath,
          afterContent: entry.content,
        },
      ],
    });
    return { nodeId };
  }

  renameManuscriptNode(id: string, title: string): void {
    const node = this.#requireManuscriptNode(id);
    const previous = this.#requireManuscriptJournalEntry(id);
    const normalizedTitle = normalizeManuscriptTitle(title);
    if (node.title === normalizedTitle) {
      return;
    }
    node.title = normalizedTitle;
    this.#rebuildCurrentManuscriptFromTree();
    const current = this.#requireManuscriptJournalEntry(id);
    this.#persistAndEmit(false, {
      source: "structure-edit",
      title: "重命名",
      groupKey: null,
      operations: [
        {
          kind: "rename",
          domain: "manuscript",
          entityId: id,
          entityKind: current.type === "chapter" ? "chapter" : "folder",
          label: current.title,
          displayPath: current.displayPath,
          previousLabel: previous.title,
          previousPath: previous.displayPath,
          beforeContent: previous.type === "chapter" ? previous.content : null,
          afterContent: current.type === "chapter" ? current.content : null,
        },
      ],
    });
  }

  moveManuscriptNode(id: string, targetParentId: string, index?: number): void {
    if (id === MANUSCRIPT_ROOT_ID) {
      throw new Error("Cannot move the manuscript root.");
    }
    const node = this.#requireManuscriptNode(id);
    if (targetParentId === id || this.#isManuscriptDescendant(id, targetParentId)) {
      throw new Error("Cannot move a manuscript node into itself or its descendants.");
    }
    const previous = this.#requireManuscriptJournalEntry(id);
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
    const current = this.#requireManuscriptJournalEntry(id);
    this.#persistAndEmit(false, {
      source: "structure-edit",
      title: sourceParent.id === targetParent.id ? "调整顺序" : "移动",
      groupKey: null,
      operations: [
        {
          kind: sourceParent.id === targetParent.id ? "reorder" : "move",
          domain: "manuscript",
          entityId: id,
          entityKind: current.type === "chapter" ? "chapter" : "folder",
          label: current.title,
          displayPath: current.displayPath,
          previousPath: previous.displayPath,
          beforeContent: previous.type === "chapter" ? previous.content : null,
          afterContent: current.type === "chapter" ? current.content : null,
        },
      ],
    });
  }

  deleteManuscriptNode(id: string): void {
    const operations = this.#collectManuscriptSubtreeIds(id).map((subtreeId) => {
      const entry = this.#requireManuscriptJournalEntry(subtreeId);
      return {
        kind: "delete" as const,
        domain: "manuscript" as const,
        entityId: subtreeId,
        entityKind: entry.type === "chapter" ? ("chapter" as const) : ("folder" as const),
        label: entry.title,
        displayPath: entry.displayPath,
        beforeContent: entry.type === "chapter" ? entry.content : null,
      };
    });
    this.#deleteManuscriptNodeFromCurrent(id);
    this.#persistAndEmit(false, {
      source: "structure-edit",
      title: "删除",
      groupKey: null,
      operations,
    });
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
    const beforeContent = entry.content;
    if (beforeContent === content) {
      return;
    }
    entry.content = content;
    this.#persistAndEmit(false, {
      source: "autosave",
      title: "自动保存",
      groupKey: `autosave:manuscript:${id}`,
      operations: [
        {
          kind: "content",
          domain: "manuscript",
          entityId: id,
          entityKind: "chapter",
          label: entry.title,
          displayPath: entry.displayPath,
          beforeContent,
          afterContent: content,
        },
      ],
    });
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
    const entry = this.#requireResourceJournalEntry(nodeId);
    this.#persistAndEmit(false, {
      source: "structure-edit",
      title: "创建文件",
      groupKey: null,
      operations: [
        {
          kind: "create",
          domain: "resource",
          entityId: nodeId,
          entityKind: "file",
          label: entry.name,
          displayPath: entry.displayPath,
          afterContent: entry.content,
        },
      ],
    });
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
    const entry = this.#requireResourceJournalEntry(nodeId);
    this.#persistAndEmit(false, {
      source: "structure-edit",
      title: "创建文件夹",
      groupKey: null,
      operations: [
        {
          kind: "create",
          domain: "resource",
          entityId: nodeId,
          entityKind: "folder",
          label: entry.name,
          displayPath: entry.displayPath,
        },
      ],
    });
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
    if (node.name === normalizedName) {
      return;
    }
    const previous = this.#requireResourceJournalEntry(id);
    this.#assertResourceSiblingNameAvailable(parentId, normalizedName, id);
    node.name = normalizedName;
    sortResourceChildrenByName(this.#resourceTree, parentId);
    this.#rebuildCurrentResourcesFromTree();
    const current = this.#requireResourceJournalEntry(id);
    this.#persistAndEmit(false, {
      source: "structure-edit",
      title: "重命名",
      groupKey: null,
      operations: [
        {
          kind: "rename",
          domain: "resource",
          entityId: id,
          entityKind: current.type,
          label: current.name,
          displayPath: current.displayPath,
          previousLabel: previous.name,
          previousPath: previous.displayPath,
          beforeContent: previous.type === "file" ? previous.content : null,
          afterContent: current.type === "file" ? current.content : null,
        },
      ],
    });
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
    const previous = this.#requireResourceJournalEntry(id);
    const sourceParent = this.#requireResourceFolder(node.parentId ?? "");
    const targetParent = this.#requireResourceFolder(targetParentId);
    this.#assertResourceSiblingNameAvailable(targetParentId, node.name);
    sourceParent.childIds = sourceParent.childIds.filter((childId) => childId !== id);
    targetParent.childIds.push(id);
    node.parentId = targetParent.id;
    sortResourceChildrenByName(this.#resourceTree, sourceParent.id);
    sortResourceChildrenByName(this.#resourceTree, targetParent.id);
    this.#rebuildCurrentResourcesFromTree();
    const current = this.#requireResourceJournalEntry(id);
    this.#persistAndEmit(false, {
      source: "structure-edit",
      title: "移动",
      groupKey: null,
      operations: [
        {
          kind: "move",
          domain: "resource",
          entityId: id,
          entityKind: current.type,
          label: current.name,
          displayPath: current.displayPath,
          previousPath: previous.displayPath,
          beforeContent: previous.type === "file" ? previous.content : null,
          afterContent: current.type === "file" ? current.content : null,
        },
      ],
    });
  }

  deleteResourceNode(id: string): void {
    const operations = this.#collectResourceSubtreeIds(id).map((subtreeId) => {
      const entry = this.#requireResourceJournalEntry(subtreeId);
      return {
        kind: "delete" as const,
        domain: "resource" as const,
        entityId: subtreeId,
        entityKind: entry.type,
        label: entry.name,
        displayPath: entry.displayPath,
        beforeContent: entry.type === "file" ? entry.content : null,
      };
    });
    this.#deleteResourceNodeFromCurrent(id);
    this.#persistAndEmit(false, {
      source: "structure-edit",
      title: "删除",
      groupKey: null,
      operations,
    });
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
    const beforeContent = entry.content;
    if (beforeContent === content) {
      return;
    }
    entry.content = content;
    this.#persistAndEmit(false, {
      source: "autosave",
      title: "自动保存",
      groupKey: `autosave:resource:${id}`,
      operations: [
        {
          kind: "content",
          domain: "resource",
          entityId: id,
          entityKind: "file",
          label: entry.name,
          displayPath: entry.displayPath,
          beforeContent,
          afterContent: content,
        },
      ],
    });
  }

  revertChange(changeId: string): ChangesSnapshot {
    const change = this.#requireChange(changeId);

    const beforeRestore = this.#currentJournalEntitySnapshot(change);
    const [domain, kind, entityId] = changeId.split(":", 3);
    if (domain === "manuscript") {
      this.#revertManuscriptChange(kind, entityId);
    } else if (domain === "resource") {
      this.#revertResourceChange(kind, entityId);
    } else {
      throw new Error(`Unsupported change domain: ${domain}`);
    }

    const afterRestore = this.#currentJournalEntitySnapshot(change);
    this.#persistAndEmit(false, {
      source: "restore",
      title: "恢复更改",
      groupKey: `restore:${change.id}`,
      operations: [
        {
          kind: "restore",
          domain: change.domain,
          entityId: change.entityId,
          entityKind: change.entityKind,
          label: afterRestore?.label ?? beforeRestore?.label ?? change.label,
          displayPath:
            afterRestore?.displayPath ?? beforeRestore?.displayPath ?? change.displayPath,
          previousPath: beforeRestore?.displayPath ?? null,
          beforeContent: beforeRestore?.content ?? null,
          afterContent: afterRestore?.content ?? null,
        },
      ],
    });
    return this.#currentChangesOnlySnapshot();
  }

  readChangeTextComparison(changeId: string): ChangeTextComparison {
    const change = this.#requireChange(changeId);
    return this.#buildChangeTextComparison(change);
  }

  readChangeTextComparisonByTarget(target: ChangeTextComparisonTarget): ChangeTextComparison {
    return this.#buildChangeTextComparison(this.#requireTextComparisonChangeByTarget(target));
  }

  restoreChangeTextHunk(
    target: ChangeTextComparisonTarget,
    expectedContent: string,
    nextContent: string,
  ): void {
    const change = this.#requireTextComparisonChangeByTarget(target);
    const { currentContent } = this.#requireTextComparisonContent(change);
    if (currentContent !== expectedContent) {
      throw new Error("当前内容已变化，请重新打开差异预览后再试。");
    }
    if (currentContent === nextContent) {
      return;
    }

    if (change.domain === "manuscript") {
      this.#restoreManuscriptTextHunk(change, expectedContent, nextContent);
    } else {
      this.#restoreResourceTextHunk(change, expectedContent, nextContent);
    }
  }

  commitChanges(message: string, author: { name: string; email: string }): ChangesSnapshot {
    const snapshotBeforeCommit = this.#currentChangesOnlySnapshot();
    const tree = this.#writeCurrentTreeToRepo();
    const parentCommit = this.#repo.readBranch(this.#branchName);
    const parents: SHA1[] = parentCommit !== null ? [parentCommit] : [];
    const now = Math.floor(Date.now() / 1000);
    const gitAuthor = { name: author.name, email: author.email, timestamp: now, timezone: "+0000" };
    const commitHash = this.#repo.createCommit(tree, parents, message, gitAuthor);
    const journalCapture = this.#journalCaptureFromChangesSnapshot(
      snapshotBeforeCommit,
      message,
      commitHash,
    );

    this.#repo.updateRef(`refs/heads/${this.#branchName}`, commitHash);
    this.#baseCommitSha = commitHash;
    this.#baseManuscriptTree = cloneManuscriptTreeSnapshot(this.#manuscriptTree);
    this.#baseResourceTree = cloneResourceTreeSnapshot(this.#resourceTree);
    this.#baseManuscript = cloneManuscriptSnapshotState(this.#currentManuscript);
    this.#baseResources = cloneResourceSnapshotState(this.#currentResources);
    this.#changeTracker.clearCache();
    this.#resetChangesStreamBaseline();
    this.#persistAndEmit(true, journalCapture);
    return this.#currentChangesOnlySnapshot();
  }

  listBranchCommits(maxCount = 50): CommitSummary[] {
    const tip = this.#repo.readBranch(this.#branchName);
    if (tip === null) {
      return [];
    }

    const commits: CommitSummary[] = [];
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

  listFileHistory(target: HistoryTarget, limit = 50): HistoryEntry[] {
    const boundedLimit = Math.max(1, Math.min(limit, 200));
    return this.#store
      .readJournalHistoryEntries(
        this.#projectId,
        this.#branchName,
        target.domain,
        target.entityId,
        boundedLimit,
      )
      .map((entry) => this.#journalEntryToHistoryEntry(entry));
  }

  readHistoryEntryContent(entryId: string): HistoryEntryContent {
    const journalEntryId = parseJournalHistoryEntryId(entryId);
    if (journalEntryId !== null) {
      const entry = this.#store.getJournalHistoryEntry(
        this.#projectId,
        this.#branchName,
        journalEntryId,
      );
      if (entry === null) {
        throw new Error(`Unknown journal history entry: ${entryId}`);
      }
      return {
        content: entry.afterContent?.toString("utf-8") ?? null,
        beforeContent: entry.beforeContent?.toString("utf-8") ?? null,
      };
    }

    throw new Error(`Unknown history entry: ${entryId}`);
  }

  restoreHistoryEntryContentHunk(
    entryId: string,
    expectedContent: string,
    nextContent: string,
  ): void {
    const journalEntryId = parseJournalHistoryEntryId(entryId);
    if (journalEntryId === null) {
      throw new Error(`Unknown history entry: ${entryId}`);
    }

    const historyEntry = this.#store.getJournalHistoryEntry(
      this.#projectId,
      this.#branchName,
      journalEntryId,
    );
    if (historyEntry === null) {
      throw new Error(`Unknown journal history entry: ${entryId}`);
    }
    if (historyEntry.afterContent === null) {
      throw new Error("此记录没有可恢复内容。");
    }

    if (historyEntry.domain === "manuscript") {
      const entry = this.#currentManuscript.entries.get(historyEntry.entityId);
      if (entry?.type !== "chapter") {
        throw new Error(`Manuscript chapter is missing: ${historyEntry.entityId}`);
      }
      if (entry.content !== expectedContent) {
        throw new Error("当前内容已变化，请重新打开历史预览后再试。");
      }
      if (entry.content === nextContent) {
        return;
      }
      entry.content = nextContent;
      this.#persistAndEmit(false, {
        source: "restore",
        title: "局部恢复",
        groupKey: `restore:hunk:${historyEntry.domain}:${historyEntry.entityId}`,
        operations: [
          {
            kind: "restore",
            domain: historyEntry.domain,
            entityId: historyEntry.entityId,
            entityKind: "chapter",
            label: entry.title,
            displayPath: entry.displayPath,
            beforeContent: expectedContent,
            afterContent: nextContent,
          },
        ],
      });
      return;
    }

    const entry = this.#currentResources.entries.get(historyEntry.entityId);
    if (entry?.type !== "file") {
      throw new Error(`Resource file is missing: ${historyEntry.entityId}`);
    }
    if (entry.content !== expectedContent) {
      throw new Error("当前内容已变化，请重新打开历史预览后再试。");
    }
    if (entry.content === nextContent) {
      return;
    }
    entry.content = nextContent;
    this.#persistAndEmit(false, {
      source: "restore",
      title: "局部恢复",
      groupKey: `restore:hunk:${historyEntry.domain}:${historyEntry.entityId}`,
      operations: [
        {
          kind: "restore",
          domain: historyEntry.domain,
          entityId: historyEntry.entityId,
          entityKind: "file",
          label: entry.name,
          displayPath: entry.displayPath,
          beforeContent: expectedContent,
          afterContent: nextContent,
        },
      ],
    });
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
    const tree = this.#readResourceTreeFromTree(baseTree);
    const rebuilt = buildResourceSnapshotFromTree(
      tree,
      (id) => readTextFromTree(this.#objects, baseTree, `${RESOURCES_FILES_DIR}/${id}.txt`) ?? "",
    );

    return {
      tree,
      snapshot: rebuilt.snapshot,
      pathById: rebuilt.pathById,
      idByPath: rebuilt.idByPath,
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
    return buildResourceSnapshotFromTree(
      this.#baseResourceTree,
      (id) => readTextFromTree(this.#objects, baseTree, `${RESOURCES_FILES_DIR}/${id}.txt`) ?? "",
    ).snapshot;
  }

  #persistAndEmit(includeCommitted = false, journalCapture?: JournalRevisionCapture): void {
    this.#warning = null;
    this.#recomputeAllChangeStatuses();
    this.#revision += 1;
    this.#persistState(includeCommitted, journalCapture);
    this.#emitChanges();
  }

  #resetChangesStreamBaseline(): void {
    this.#lastPublishedManuscriptTree = null;
    this.#lastPublishedResourceTree = null;
  }

  #recordChangesStreamEmit(changesSnapshot: ChangesSnapshot): void {
    this.#changeTracker.markChangesEmitted(changesSnapshot);
    this.#lastPublishedManuscriptTree = cloneManuscriptTreeSnapshot(this.#manuscriptTree);
    this.#lastPublishedResourceTree = cloneResourceTreeSnapshot(this.#resourceTree);
  }

  #buildChangesSnapshotEvent(
    changesSnapshot: ChangesSnapshot,
  ): Extract<ChangesEvent, { kind: "snapshot" }> {
    return {
      kind: "snapshot",
      snapshot: changesSnapshot,
      treeSnapshot: {
        manuscript: cloneManuscriptTreeSnapshot(this.#manuscriptTree),
        resources: cloneResourceTreeSnapshot(this.#resourceTree),
      },
    };
  }

  #buildTreeDeltaFromLastPublished(): ChangesTreeDelta | undefined {
    if (this.#lastPublishedManuscriptTree === null || this.#lastPublishedResourceTree === null) {
      return undefined;
    }
    const treeDelta: ChangesTreeDelta = {};
    const manuscriptDelta = computeManuscriptTreeDelta(
      this.#lastPublishedManuscriptTree,
      this.#manuscriptTree,
    );
    if (manuscriptDelta !== undefined && !isEmptyManuscriptTreeDelta(manuscriptDelta)) {
      treeDelta.manuscript = manuscriptDelta;
    }
    const resourceDelta = computeResourceTreeDelta(
      this.#lastPublishedResourceTree,
      this.#resourceTree,
    );
    if (resourceDelta !== undefined && !isEmptyResourceTreeDelta(resourceDelta)) {
      treeDelta.resources = resourceDelta;
    }
    return Object.keys(treeDelta).length > 0 ? treeDelta : undefined;
  }

  #emitChanges(): void {
    const currentSnapshot = this.#currentChangesSnapshot();
    if (currentSnapshot.kind !== "snapshot") {
      return;
    }
    const changesSnapshot = currentSnapshot.snapshot;

    const needsFullSnapshot =
      this.#lastPublishedManuscriptTree === null ||
      this.#lastPublishedResourceTree === null ||
      !this.#changeTracker.hasEmittedChanges();

    if (needsFullSnapshot) {
      const event = this.#buildChangesSnapshotEvent(changesSnapshot);
      this.#changesPublisher.emit(event);
      this.#recordChangesStreamEmit(changesSnapshot);
      return;
    }

    const delta = this.#changeTracker.computeDelta(changesSnapshot, this.#revision);
    if (delta.addedChanges.length === 0 && delta.removedChangeIds.length === 0) {
      const event = this.#buildChangesSnapshotEvent(changesSnapshot);
      this.#changesPublisher.emit(event);
      this.#recordChangesStreamEmit(changesSnapshot);
      return;
    }

    this.#changesPublisher.emit({
      kind: "delta",
      delta: {
        fromRevision: delta.fromRevision,
        toRevision: delta.toRevision,
        addedChanges: delta.addedChanges,
        removedChangeIds: delta.removedChangeIds,
      },
      treeDelta: this.#buildTreeDeltaFromLastPublished(),
    });
    this.#recordChangesStreamEmit(changesSnapshot);
  }

  #persistState(includeCommitted: boolean, journalCapture?: JournalRevisionCapture): void {
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
      if (journalCapture !== undefined) {
        this.#recordJournalEntries(journalCapture);
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
    rootEntries.push({
      mode: "040000",
      name: RESOURCES_DIR,
      hash: this.#writeCurrentResourcesTreeToRepo(),
    });
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

  #writeCurrentResourcesTreeToRepo(): SHA1 {
    const index = `${JSON.stringify(resourceIndexFromTree(this.#resourceTree), null, 2)}\n`;
    const entries = [
      {
        mode: "100644",
        name: RESOURCES_INDEX_FILE,
        hash: this.#repo.writeBlob(Buffer.from(index, "utf-8")),
      },
    ];
    const fileEntries = sortedEntryValues(this.#currentResources.entries)
      .filter((entry) => entry.type === "file")
      .map((entry) => ({
        mode: "100644",
        name: `${entry.id}.txt`,
        hash: this.#repo.writeBlob(Buffer.from(entry.content, "utf-8")),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
    if (fileEntries.length > 0) {
      entries.push({
        mode: "040000",
        name: RESOURCES_FILES_DIR_NAME,
        hash: this.#repo.createTree(fileEntries),
      });
    }
    return this.#repo.createTree(entries);
  }

  #recordJournalEntries(capture: JournalRevisionCapture): void {
    if (capture.operations.length === 0) {
      return;
    }
    const now = Date.now();
    const entries: WorktreeJournalEntryRecord[] = [];

    for (const operation of capture.operations) {
      const beforeContent = this.#journalContentForOperation(capture.source, operation, "before");
      const afterContent = this.#journalContentForOperation(capture.source, operation, "after");

      const mergeWindowMs =
        capture.source === "autosave" && operation.kind === "content"
          ? AUTOSAVE_JOURNAL_MERGE_WINDOW_MS
          : capture.source === "restore" && operation.kind === "restore"
            ? RESTORE_HUNK_JOURNAL_MERGE_WINDOW_MS
            : null;
      if (mergeWindowMs !== null && capture.groupKey !== null) {
        const existing = this.#store.getMergeableJournalEntry(
          this.#projectId,
          this.#branchName,
          operation.domain,
          operation.entityId,
          capture.source,
          operation.kind,
          capture.groupKey,
          now - mergeWindowMs,
        );
        if (existing !== null) {
          const mergedBeforeContent =
            existing.beforeContent?.toString("utf-8") ?? beforeContent ?? null;
          const afterBlobId = this.#upsertJournalContentBlob(afterContent);
          const stats =
            mergedBeforeContent !== null && afterContent !== null
              ? computeStats(mergedBeforeContent, afterContent)
              : null;
          this.#store.updateJournalEntryAfterContent({
            projectId: this.#projectId,
            branchName: this.#branchName,
            entryId: existing.entryId,
            updatedAt: now,
            worktreeRevision: this.#revision,
            label: operation.label,
            displayPath: operation.displayPath,
            afterBlobId,
            statsAdded: stats?.added ?? null,
            statsRemoved: stats?.removed ?? null,
          });
          continue;
        }
      }

      const beforeBlobId = this.#upsertJournalContentBlob(beforeContent);
      const afterBlobId = this.#upsertJournalContentBlob(afterContent);
      const stats =
        beforeContent !== null && afterContent !== null
          ? computeStats(beforeContent, afterContent)
          : null;
      entries.push({
        projectId: this.#projectId,
        branchName: this.#branchName,
        entryId: nanoid(12),
        createdAt: now,
        updatedAt: now,
        worktreeRevision: this.#revision,
        actor: "user",
        source: capture.source,
        title: capture.title,
        kind: operation.kind,
        domain: operation.domain,
        entityId: operation.entityId,
        entityKind: operation.entityKind,
        label: operation.label,
        displayPath: operation.displayPath,
        previousLabel: operation.previousLabel ?? null,
        previousPath: operation.previousPath ?? null,
        beforeBlobId,
        afterBlobId,
        statsAdded: stats?.added ?? null,
        statsRemoved: stats?.removed ?? null,
        commitHash: capture.commitHash ?? null,
        groupKey: capture.groupKey,
        metadataJson: null,
        beforeContent: null,
        afterContent: null,
      });
    }

    this.#store.insertJournalEntries(entries);
  }

  #journalContentForOperation(
    source: WorktreeJournalSource,
    operation: JournalOperationCapture,
    side: "before" | "after",
  ): string | null {
    if (operation.kind === "rename" || operation.kind === "move" || operation.kind === "reorder") {
      return null;
    }
    if (source !== "autosave" && operation.kind === "content") {
      return side === "before"
        ? (operation.beforeContent ?? null)
        : (operation.afterContent ?? null);
    }
    return side === "before" ? (operation.beforeContent ?? null) : (operation.afterContent ?? null);
  }

  #upsertJournalContentBlob(content: string | null): string | null {
    if (content === null) {
      return null;
    }
    const contentSha = sha1Text(content);
    this.#store.upsertJournalBlob({
      projectId: this.#projectId,
      blobId: contentSha,
      contentSha,
      content: Buffer.from(content, "utf-8"),
    });
    return contentSha;
  }

  #journalCaptureFromChangesSnapshot(
    snapshot: ChangesSnapshot,
    message: string,
    commitHash: string,
  ): JournalRevisionCapture | undefined {
    const operations = [...snapshot.manuscriptChanges, ...snapshot.resourceChanges].map((change) =>
      this.#journalOperationFromChange(change),
    );
    if (operations.length === 0) {
      return undefined;
    }
    const title = message.split("\n")[0]?.trim() || "(无提交说明)";
    return {
      source: "commit",
      title,
      commitHash,
      groupKey: `commit:${commitHash}`,
      operations,
    };
  }

  #journalOperationFromChange(change: Change): JournalOperationCapture {
    const beforeContent = this.#journalContentForChange(change, "before");
    const afterContent = this.#journalContentForChange(change, "after");
    return {
      kind: change.kind,
      domain: change.domain,
      entityId: change.entityId,
      entityKind: change.entityKind,
      label: change.label,
      displayPath: change.displayPath,
      previousLabel: "previousLabel" in change ? change.previousLabel : null,
      previousPath: "previousPath" in change ? change.previousPath : null,
      beforeContent,
      afterContent,
    };
  }

  #journalContentForChange(change: Change, side: "before" | "after"): string | null {
    if (change.entityKind !== "chapter" && change.entityKind !== "file") {
      return null;
    }
    if (change.domain === "manuscript") {
      const state = side === "before" ? this.#baseManuscript : this.#currentManuscript;
      const entry = state.entries.get(change.entityId);
      return entry?.type === "chapter" ? entry.content : null;
    }
    const state = side === "before" ? this.#baseResources : this.#currentResources;
    const entry = state.entries.get(change.entityId);
    return entry?.type === "file" ? entry.content : null;
  }

  #requireChange(changeId: string): Change {
    const snapshot = this.#currentChangesOnlySnapshot();
    const change = [...snapshot.manuscriptChanges, ...snapshot.resourceChanges].find(
      (candidate) => candidate.id === changeId,
    );
    if (change === undefined) {
      throw new Error(`Unknown change: ${changeId}`);
    }
    return change;
  }

  #requireTextComparisonChangeByTarget(target: ChangeTextComparisonTarget): Change {
    const snapshot = this.#currentChangesOnlySnapshot();
    const change = [...snapshot.manuscriptChanges, ...snapshot.resourceChanges].find(
      (candidate) =>
        candidate.domain === target.domain &&
        candidate.entityId === target.entityId &&
        (candidate.kind === "create" ||
          candidate.kind === "delete" ||
          candidate.kind === "content") &&
        (candidate.entityKind === "chapter" || candidate.entityKind === "file"),
    );
    if (change === undefined) {
      throw new Error("此节点当前没有可预览的文本差异。");
    }
    return change;
  }

  #buildChangeTextComparison(change: Change): ChangeTextComparison {
    const { originalContent, currentContent } = this.#requireTextComparisonContent(change);
    return {
      target: {
        domain: change.domain,
        entityId: change.entityId,
      },
      changeId: change.id,
      kind: change.kind,
      label: change.label,
      displayPath: change.displayPath,
      originalContent,
      currentContent,
    };
  }

  #requireTextComparisonContent(change: Change): {
    originalContent: string;
    currentContent: string;
  } {
    if (change.kind !== "create" && change.kind !== "delete" && change.kind !== "content") {
      throw new Error("此类变更暂不支持文本差异预览。");
    }
    if (change.entityKind !== "chapter" && change.entityKind !== "file") {
      throw new Error("只有文本叶子节点支持差异预览。");
    }

    const originalContent = this.#journalContentForChange(change, "before");
    const currentContent = this.#journalContentForChange(change, "after");

    return {
      originalContent: originalContent ?? "",
      currentContent: currentContent ?? "",
    };
  }

  #restoreManuscriptTextHunk(change: Change, expectedContent: string, nextContent: string): void {
    if (change.entityKind !== "chapter") {
      throw new Error("Only manuscript chapter changes support text restore.");
    }

    if (change.kind === "delete") {
      this.#restoreManuscriptSubtreeFromBase(change.entityId);
      const restoredEntry = this.#currentManuscript.entries.get(change.entityId);
      if (restoredEntry?.type !== "chapter") {
        throw new Error(`Manuscript chapter is missing: ${change.entityId}`);
      }
      restoredEntry.content = nextContent;
    } else {
      const entry = this.#currentManuscript.entries.get(change.entityId);
      if (entry?.type !== "chapter") {
        throw new Error(`Manuscript chapter is missing: ${change.entityId}`);
      }
      entry.content = nextContent;
    }

    this.#persistAndEmit(false, {
      source: "restore",
      title: "局部恢复",
      groupKey: `restore:hunk:${change.domain}:${change.entityId}`,
      operations: [
        {
          kind: "restore",
          domain: change.domain,
          entityId: change.entityId,
          entityKind: "chapter",
          label: this.#currentManuscript.entries.get(change.entityId)?.title ?? change.label,
          displayPath:
            this.#currentManuscript.entries.get(change.entityId)?.displayPath ?? change.displayPath,
          beforeContent: expectedContent,
          afterContent: nextContent,
        },
      ],
    });
  }

  #restoreResourceTextHunk(change: Change, expectedContent: string, nextContent: string): void {
    if (change.entityKind !== "file") {
      throw new Error("Only resource file changes support text restore.");
    }

    if (change.kind === "delete") {
      this.#restoreResourceSubtreeFromBase(change.entityId);
      const restoredEntry = this.#currentResources.entries.get(change.entityId);
      if (restoredEntry?.type !== "file") {
        throw new Error(`Resource file is missing: ${change.entityId}`);
      }
      restoredEntry.content = nextContent;
    } else {
      const entry = this.#currentResources.entries.get(change.entityId);
      if (entry?.type !== "file") {
        throw new Error(`Resource file is missing: ${change.entityId}`);
      }
      entry.content = nextContent;
    }

    this.#persistAndEmit(false, {
      source: "restore",
      title: "局部恢复",
      groupKey: `restore:hunk:${change.domain}:${change.entityId}`,
      operations: [
        {
          kind: "restore",
          domain: change.domain,
          entityId: change.entityId,
          entityKind: "file",
          label: this.#currentResources.entries.get(change.entityId)?.name ?? change.label,
          displayPath:
            this.#currentResources.entries.get(change.entityId)?.displayPath ?? change.displayPath,
          beforeContent: expectedContent,
          afterContent: nextContent,
        },
      ],
    });
  }

  #currentJournalEntitySnapshot(change: Change): JournalEntitySnapshot | null {
    if (change.domain === "manuscript") {
      const entry = this.#currentManuscript.entries.get(change.entityId);
      if (entry === undefined) {
        return null;
      }
      return {
        label: entry.title,
        displayPath: entry.displayPath,
        content: entry.type === "chapter" ? entry.content : null,
      };
    }

    const entry = this.#currentResources.entries.get(change.entityId);
    if (entry === undefined) {
      return null;
    }
    return {
      label: entry.name,
      displayPath: entry.displayPath,
      content: entry.type === "file" ? entry.content : null,
    };
  }

  #journalEntryToHistoryEntry(entry: WorktreeJournalEntryRecord): HistoryEntry {
    return {
      id: journalHistoryEntryId(entry.entryId),
      source: "journal",
      revisionSource: entry.source,
      actor: entry.actor,
      kind: entry.kind,
      domain: entry.domain,
      entityId: entry.entityId,
      label: entry.label,
      displayPath: entry.displayPath,
      timestamp: entry.updatedAt,
      message: entry.title,
      stats:
        entry.statsAdded === null || entry.statsRemoved === null
          ? undefined
          : { added: entry.statsAdded, removed: entry.statsRemoved },
      commitHash: entry.commitHash ?? undefined,
      shortHash: entry.commitHash?.slice(0, 7),
      revisionId: entry.entryId,
      groupId: entry.groupKey ?? undefined,
      hasContent: entry.afterContent !== null,
    };
  }

  #readResourceTreeFromTree(treeHash: SHA1): ResourceTreeSnapshot {
    return resourceTreeFromIndex(
      parseResourceIndex(readTextFromTree(this.#objects, treeHash, RESOURCES_INDEX_PATH)),
    );
  }

  #currentChangesOnlySnapshot(): ChangesSnapshot {
    return buildJournalChangesSnapshot({
      revision: this.#revision,
      baseTree: this.baseTree,
      warning: this.#warning,
      baseManuscript: this.#baseManuscript,
      currentManuscript: this.#currentManuscript,
      baseResources: this.#baseResources,
      currentResources: this.#currentResources,
    });
  }

  #currentChangesSnapshot(): ChangesEvent {
    const changesSnapshot = this.#currentChangesOnlySnapshot();
    return {
      kind: "snapshot",
      snapshot: changesSnapshot,
      treeSnapshot: {
        manuscript: this.#manuscriptTree,
        resources: this.#resourceTree,
      },
    };
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

  #requireManuscriptJournalEntry(id: string): ManuscriptEntry {
    const entry = this.#currentManuscript.entries.get(id);
    if (entry === undefined) {
      throw new Error(`Manuscript journal entry does not exist: ${id}`);
    }
    return entry;
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

  #requireResourceJournalEntry(id: string): ResourceSnapshotEntry {
    const entry = this.#currentResources.entries.get(id);
    if (entry === undefined) {
      throw new Error(`Resource journal entry does not exist: ${id}`);
    }
    return entry;
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
