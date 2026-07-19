import type { SHA1 } from "nano-git";
import { walkLogEntries } from "nano-git/log";

import type {
  Change,
  ChangeTextComparisonTarget,
  ChangesSnapshot,
  CommitChangeTextComparison,
  CommitChangesSnapshot,
  CommitSummary,
  HistoryEntry,
  HistoryEntryContent,
  HistoryTarget,
  ManuscriptTreeSnapshot,
  ResourceTreeSnapshot,
} from "#shared/rpc/worktree/index";

import type { WorktreeJournalEntryRecord } from "../../db/repositories/worktree-repo";
import { readTextFromTree } from "../git/diff-utils";
import { buildJournalChangesSnapshot } from "../journal/journal-pending-projector";
import type { JournalOperationCapture } from "../journal/journal-types";
import { journalHistoryEntryId, parseJournalHistoryEntryId } from "../journal/journal-types";
import { clampChildIndex, MANUSCRIPT_ROOT_ID } from "../manuscript/outline";
import { chapterBodyPath } from "../manuscript/paths";
import { RESOURCE_ROOT_ID } from "../resources/index";
import { buildBaseManuscriptSnapshot } from "../snapshots/manuscript";
import type { ManuscriptSnapshotState } from "../snapshots/manuscript";
import { cloneResourceSnapshotState, type ResourceSnapshotState } from "../snapshots/resource";
import {
  cloneManuscriptSnapshotState,
  cloneManuscriptTreeNode,
  cloneManuscriptTreeSnapshot,
  cloneResourceTreeNode,
  cloneResourceTreeSnapshot,
} from "../trees/tree-clone";
import {
  buildResourceSnapshotFromTree,
  manuscriptTreeFromOutline,
} from "../trees/worktree-tree-bridge";
import { currentChangesOnlySnapshot } from "./changes-snapshot";
import {
  readResourceTreeFromTree,
  requireManuscriptFolder,
  requireResourceFolder,
} from "./helpers";
import { persistAndEmit } from "./persistence";
import { rebuildCurrentManuscriptFromTree, rebuildCurrentResourcesFromTree } from "./rebuild";
import { RESOURCES_FILES_DIR, type WorktreeSessionState } from "./state";

function buildResourceSnapshotAtTree(
  state: WorktreeSessionState,
  treeHash: SHA1,
): ResourceSnapshotState {
  const tree = readResourceTreeFromTree(state, treeHash);
  return buildResourceSnapshotFromTree(
    tree,
    (id) => readTextFromTree(state.objects, treeHash, `${RESOURCES_FILES_DIR}/${id}.txt`) ?? "",
  ).snapshot;
}

type CommitBoundary = {
  commitHash: SHA1;
  parentHash: SHA1 | null;
  commitTree: SHA1;
  parentTree: SHA1;
};

function requireCommitObject(state: WorktreeSessionState, commitHash: string) {
  let object;
  try {
    object = state.repo.catFile(commitHash as SHA1);
  } catch {
    throw new Error(`Unknown commit: ${commitHash}`);
  }
  if (object.type !== "commit") {
    throw new Error(`Expected commit at ${commitHash}, got ${object.type}.`);
  }
  return object;
}

function resolveCommitBoundary(state: WorktreeSessionState, commitHash: string): CommitBoundary {
  const commit = requireCommitObject(state, commitHash);
  const parentHash = commit.parents[0] ?? null;
  let parentTree: SHA1;
  if (parentHash === null) {
    parentTree = state.repo.createTree([]);
  } else {
    const parent = requireCommitObject(state, parentHash);
    parentTree = parent.tree;
  }
  return {
    commitHash: commitHash as SHA1,
    parentHash,
    commitTree: commit.tree,
    parentTree,
  };
}

function scopeChangeId(commitHash: string, change: Change): Change {
  return {
    ...change,
    id: `commit:${commitHash}:${change.id}`,
  };
}

function readEntityTextFromTree(
  state: WorktreeSessionState,
  treeHash: SHA1,
  domain: ChangeTextComparisonTarget["domain"],
  entityId: string,
): string {
  if (domain === "manuscript") {
    return readTextFromTree(state.objects, treeHash, chapterBodyPath(entityId)) ?? "";
  }
  return readTextFromTree(state.objects, treeHash, `${RESOURCES_FILES_DIR}/${entityId}.txt`) ?? "";
}

export function listCommitChanges(
  state: WorktreeSessionState,
  commitHash: string,
): CommitChangesSnapshot {
  const boundary = resolveCommitBoundary(state, commitHash);
  const baseManuscript = buildBaseManuscriptSnapshot(state.objects, boundary.parentTree);
  const currentManuscript = buildBaseManuscriptSnapshot(state.objects, boundary.commitTree);
  const baseResources = buildResourceSnapshotAtTree(state, boundary.parentTree);
  const currentResources = buildResourceSnapshotAtTree(state, boundary.commitTree);

  const projected = buildJournalChangesSnapshot({
    revision: 0,
    baseTree: boundary.parentTree,
    warning: null,
    baseManuscript,
    currentManuscript,
    baseResources,
    currentResources,
  });

  return {
    commitHash: boundary.commitHash,
    parentHash: boundary.parentHash,
    manuscriptChanges: projected.manuscriptChanges.map((change) =>
      scopeChangeId(boundary.commitHash, change),
    ),
    resourceChanges: projected.resourceChanges.map((change) =>
      scopeChangeId(boundary.commitHash, change),
    ),
  };
}

export function readCommitChangeTextComparison(
  state: WorktreeSessionState,
  commitHash: string,
  target: ChangeTextComparisonTarget,
): CommitChangeTextComparison {
  const boundary = resolveCommitBoundary(state, commitHash);
  const baseManuscript = buildBaseManuscriptSnapshot(state.objects, boundary.parentTree);
  const currentManuscript = buildBaseManuscriptSnapshot(state.objects, boundary.commitTree);
  const baseResources = buildResourceSnapshotAtTree(state, boundary.parentTree);
  const currentResources = buildResourceSnapshotAtTree(state, boundary.commitTree);

  const projected = buildJournalChangesSnapshot({
    revision: 0,
    baseTree: boundary.parentTree,
    warning: null,
    baseManuscript,
    currentManuscript,
    baseResources,
    currentResources,
  });

  const allChanges = [...projected.manuscriptChanges, ...projected.resourceChanges];
  const change = allChanges.find(
    (candidate) =>
      candidate.domain === target.domain &&
      candidate.entityId === target.entityId &&
      (candidate.kind === "create" ||
        candidate.kind === "delete" ||
        candidate.kind === "content") &&
      (candidate.entityKind === "chapter" || candidate.entityKind === "file"),
  );
  if (change === undefined) {
    throw new Error(
      `No previewable text change for ${target.domain}:${target.entityId} in commit ${commitHash}.`,
    );
  }

  const originalContent =
    change.kind === "create"
      ? ""
      : readEntityTextFromTree(state, boundary.parentTree, target.domain, target.entityId);
  const currentContent =
    change.kind === "delete"
      ? ""
      : readEntityTextFromTree(state, boundary.commitTree, target.domain, target.entityId);

  return {
    target,
    changeId: scopeChangeId(boundary.commitHash, change).id,
    kind: change.kind,
    label: change.label,
    displayPath: change.displayPath,
    originalContent,
    currentContent,
  };
}

export function journalEntryToHistoryEntry(
  state: WorktreeSessionState,
  entry: WorktreeJournalEntryRecord,
): HistoryEntry {
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

export function listBranchCommits(state: WorktreeSessionState, maxCount = 50): CommitSummary[] {
  const tip = state.repo.readBranch(state.branchName);
  if (tip === null) {
    return [];
  }

  const commits: CommitSummary[] = [];
  for (const entry of walkLogEntries(state.objects, { from: [tip], maxCount })) {
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

export function listFileHistory(
  state: WorktreeSessionState,
  target: HistoryTarget,
  limit = 50,
): HistoryEntry[] {
  const boundedLimit = Math.max(1, Math.min(limit, 200));
  return state.store
    .readJournalHistoryEntries(
      state.projectId,
      state.branchName,
      target.domain,
      target.entityId,
      boundedLimit,
    )
    .map((entry) => journalEntryToHistoryEntry(state, entry));
}

export function readHistoryEntryContent(
  state: WorktreeSessionState,
  entryId: string,
): HistoryEntryContent {
  const journalEntryId = parseJournalHistoryEntryId(entryId);
  if (journalEntryId !== null) {
    const entry = state.store.getJournalHistoryEntry(
      state.projectId,
      state.branchName,
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

export function readHistoryEntry(state: WorktreeSessionState, entryId: string): HistoryEntry {
  const journalEntryId = parseJournalHistoryEntryId(entryId);
  if (journalEntryId === null) throw new Error(`Unknown history entry: ${entryId}`);
  const entry = state.store.getJournalHistoryEntry(
    state.projectId,
    state.branchName,
    journalEntryId,
  );
  if (entry === null) throw new Error(`Unknown journal history entry: ${entryId}`);
  return journalEntryToHistoryEntry(state, entry);
}

export function restoreHistoryEntryContentHunk(
  state: WorktreeSessionState,
  entryId: string,
  expectedContent: string,
  nextContent: string,
): void {
  const journalEntryId = parseJournalHistoryEntryId(entryId);
  if (journalEntryId === null) {
    throw new Error(`Unknown history entry: ${entryId}`);
  }

  const historyEntry = state.store.getJournalHistoryEntry(
    state.projectId,
    state.branchName,
    journalEntryId,
  );
  if (historyEntry === null) {
    throw new Error(`Unknown journal history entry: ${entryId}`);
  }
  if (historyEntry.afterContent === null) {
    throw new Error("此记录没有可恢复内容。");
  }

  if (historyEntry.domain === "manuscript") {
    const entry = state.currentManuscript.entries.get(historyEntry.entityId);
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
    persistAndEmit(state, false, {
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

  const entry = state.currentResources.entries.get(historyEntry.entityId);
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
  persistAndEmit(state, false, {
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

type LeafEntitySnapshot = {
  domain: "manuscript" | "resource";
  entityId: string;
  entityKind: "chapter" | "file";
  label: string;
  displayPath: string;
  content: string;
};

function leafKey(domain: LeafEntitySnapshot["domain"], entityId: string): string {
  return `${domain}:${entityId}`;
}

function collectLeafEntitySnapshots(state: WorktreeSessionState): Map<string, LeafEntitySnapshot> {
  const leaves = new Map<string, LeafEntitySnapshot>();
  for (const entry of state.currentManuscript.entries.values()) {
    if (entry.type !== "chapter") {
      continue;
    }
    leaves.set(leafKey("manuscript", entry.id), {
      domain: "manuscript",
      entityId: entry.id,
      entityKind: "chapter",
      label: entry.title,
      displayPath: entry.displayPath,
      content: entry.content,
    });
  }
  for (const entry of state.currentResources.entries.values()) {
    if (entry.type !== "file") {
      continue;
    }
    leaves.set(leafKey("resource", entry.id), {
      domain: "resource",
      entityId: entry.id,
      entityKind: "file",
      label: entry.name,
      displayPath: entry.displayPath,
      content: entry.content,
    });
  }
  return leaves;
}

function buildRestoreOperationsFromLeaves(
  beforeLeaves: ReadonlyMap<string, LeafEntitySnapshot>,
  afterLeaves: ReadonlyMap<string, LeafEntitySnapshot>,
): JournalOperationCapture[] {
  const operations: JournalOperationCapture[] = [];
  const keys = new Set([...beforeLeaves.keys(), ...afterLeaves.keys()]);
  for (const key of keys) {
    const before = beforeLeaves.get(key);
    const after = afterLeaves.get(key);
    if (before !== undefined && after !== undefined && before.content === after.content) {
      continue;
    }
    if (before === undefined && after === undefined) {
      continue;
    }
    const domain = after?.domain ?? before!.domain;
    const entityId = after?.entityId ?? before!.entityId;
    const entityKind = after?.entityKind ?? before!.entityKind;
    operations.push({
      kind: "restore",
      domain,
      entityId,
      entityKind,
      label: after?.label ?? before!.label,
      displayPath: after?.displayPath ?? before!.displayPath,
      previousPath: before?.displayPath ?? null,
      beforeContent: before?.content ?? null,
      afterContent: after?.content ?? null,
    });
  }
  return operations;
}

function applyResourceSnapshotToState(
  state: WorktreeSessionState,
  tree: ResourceTreeSnapshot,
  snapshot: ResourceSnapshotState,
  pathById: ReadonlyMap<string, string>,
  idByPath: ReadonlyMap<string, string>,
): void {
  state.resourceTree = cloneResourceTreeSnapshot(tree);
  state.currentResources = cloneResourceSnapshotState(snapshot);
  state.resourcePathById.clear();
  state.resourceIdByPath.clear();
  for (const [id, path] of pathById.entries()) {
    state.resourcePathById.set(id, path);
  }
  for (const [path, id] of idByPath.entries()) {
    state.resourceIdByPath.set(path, id);
  }
}

function loadManuscriptAtTree(
  state: WorktreeSessionState,
  treeHash: SHA1,
): {
  tree: ManuscriptTreeSnapshot;
  snapshot: ManuscriptSnapshotState;
} {
  const snapshot = buildBaseManuscriptSnapshot(state.objects, treeHash);
  return {
    tree: manuscriptTreeFromOutline(snapshot.outline),
    snapshot,
  };
}

function loadResourcesAtTree(
  state: WorktreeSessionState,
  treeHash: SHA1,
): {
  tree: ResourceTreeSnapshot;
  snapshot: ResourceSnapshotState;
  pathById: Map<string, string>;
  idByPath: Map<string, string>;
} {
  const tree = readResourceTreeFromTree(state, treeHash);
  const rebuilt = buildResourceSnapshotFromTree(
    tree,
    (id) => readTextFromTree(state.objects, treeHash, `${RESOURCES_FILES_DIR}/${id}.txt`) ?? "",
  );
  return {
    tree,
    snapshot: rebuilt.snapshot,
    pathById: rebuilt.pathById,
    idByPath: rebuilt.idByPath,
  };
}

/**
 * Restore the full draft working tree from a commit without moving tip/base.
 */
export function restoreWorkingTreeFromCommit(
  state: WorktreeSessionState,
  commitHash: string,
): ChangesSnapshot {
  const commit = requireCommitObject(state, commitHash);
  const commitTree = commit.tree;
  const shortHash = commitHash.slice(0, 7);
  const beforeLeaves = collectLeafEntitySnapshots(state);

  const manuscript = loadManuscriptAtTree(state, commitTree);
  const resources = loadResourcesAtTree(state, commitTree);

  state.manuscriptTree = cloneManuscriptTreeSnapshot(manuscript.tree);
  state.currentManuscript = cloneManuscriptSnapshotState(manuscript.snapshot);
  applyResourceSnapshotToState(
    state,
    resources.tree,
    resources.snapshot,
    resources.pathById,
    resources.idByPath,
  );
  state.changeTracker.clearCache();

  const afterLeaves = collectLeafEntitySnapshots(state);
  const operations = buildRestoreOperationsFromLeaves(beforeLeaves, afterLeaves);
  persistAndEmit(
    state,
    false,
    operations.length === 0
      ? undefined
      : {
          source: "restore",
          title: `恢复到提交 ${shortHash}`,
          groupKey: `restore:commit:${commitHash}`,
          operations,
        },
  );
  return currentChangesOnlySnapshot(state);
}

function ensureManuscriptAncestorsFromSource(
  state: WorktreeSessionState,
  parentId: string,
  sourceTree: ManuscriptTreeSnapshot,
  sourceManuscript: ManuscriptSnapshotState,
): void {
  if (parentId === MANUSCRIPT_ROOT_ID || parentId === "") {
    return;
  }
  if (state.manuscriptTree.nodes[parentId] !== undefined) {
    return;
  }

  const sourceEntry = sourceManuscript.entries.get(parentId);
  if (sourceEntry === undefined) {
    throw new Error(`提交中缺少祖先节点：${parentId}`);
  }
  ensureManuscriptAncestorsFromSource(state, sourceEntry.parentId, sourceTree, sourceManuscript);

  const sourceNode = sourceTree.nodes[parentId];
  if (sourceNode === undefined || sourceNode.type !== "folder") {
    throw new Error(`提交中缺少文件夹节点：${parentId}`);
  }
  state.manuscriptTree.nodes[parentId] = cloneManuscriptTreeNode({
    ...sourceNode,
    childIds: [],
  });
  const parent = requireManuscriptFolder(state, sourceEntry.parentId);
  if (!parent.childIds.includes(parentId)) {
    parent.childIds.splice(clampChildIndex(sourceEntry.index, parent.childIds.length), 0, parentId);
  }
  rebuildCurrentManuscriptFromTree(state);
}

function ensureResourceAncestorsFromSource(
  state: WorktreeSessionState,
  parentId: string,
  sourceTree: ResourceTreeSnapshot,
  sourceResources: ResourceSnapshotState,
): void {
  if (parentId === RESOURCE_ROOT_ID || parentId === "") {
    return;
  }
  if (state.resourceTree.nodes[parentId] !== undefined) {
    return;
  }

  const sourceEntry = sourceResources.entries.get(parentId);
  if (sourceEntry === undefined) {
    throw new Error(`提交中缺少祖先节点：${parentId}`);
  }
  ensureResourceAncestorsFromSource(state, sourceEntry.parentId, sourceTree, sourceResources);

  const sourceNode = sourceTree.nodes[parentId];
  if (sourceNode === undefined || sourceNode.type !== "folder") {
    throw new Error(`提交中缺少文件夹节点：${parentId}`);
  }
  state.resourceTree.nodes[parentId] = cloneResourceTreeNode({
    ...sourceNode,
    childIds: [],
  });
  const parent = requireResourceFolder(state, sourceEntry.parentId);
  if (!parent.childIds.includes(parentId)) {
    parent.childIds.splice(clampChildIndex(sourceEntry.index, parent.childIds.length), 0, parentId);
  }
  rebuildCurrentResourcesFromTree(state);
}

/**
 * Restore one leaf entity from a commit into the draft (tip/base unchanged).
 * Recreates missing nodes from the commit tree when needed.
 */
export function restoreEntityFromCommit(
  state: WorktreeSessionState,
  commitHash: string,
  target: HistoryTarget,
): ChangesSnapshot {
  const commit = requireCommitObject(state, commitHash);
  const commitTree = commit.tree;
  const shortHash = commitHash.slice(0, 7);

  if (target.domain === "manuscript") {
    const source = loadManuscriptAtTree(state, commitTree);
    const sourceEntry = source.snapshot.entries.get(target.entityId);
    if (sourceEntry === undefined) {
      throw new Error("此提交中不存在该节点。");
    }
    if (sourceEntry.type !== "chapter") {
      throw new Error("只能恢复章节正文。");
    }

    const beforeEntry = state.currentManuscript.entries.get(target.entityId);
    const beforeContent = beforeEntry?.type === "chapter" ? beforeEntry.content : null;
    if (beforeEntry?.type === "chapter" && beforeEntry.content === sourceEntry.content) {
      return currentChangesOnlySnapshot(state);
    }

    ensureManuscriptAncestorsFromSource(state, sourceEntry.parentId, source.tree, source.snapshot);

    const existingNode = state.manuscriptTree.nodes[target.entityId];
    if (existingNode === undefined) {
      const sourceNode = source.tree.nodes[target.entityId];
      if (sourceNode === undefined || sourceNode.type !== "chapter") {
        throw new Error("此提交中不存在该章节。");
      }
      state.manuscriptTree.nodes[target.entityId] = cloneManuscriptTreeNode(sourceNode);
      const parent = requireManuscriptFolder(state, sourceEntry.parentId);
      if (!parent.childIds.includes(target.entityId)) {
        parent.childIds.splice(
          clampChildIndex(sourceEntry.index, parent.childIds.length),
          0,
          target.entityId,
        );
      }
      rebuildCurrentManuscriptFromTree(state, new Map([[target.entityId, sourceEntry.content]]));
    } else if (existingNode.type !== "chapter") {
      throw new Error("当前节点不是章节，无法恢复正文。");
    } else {
      const entry = state.currentManuscript.entries.get(target.entityId);
      if (entry?.type !== "chapter") {
        throw new Error(`Manuscript chapter is missing: ${target.entityId}`);
      }
      entry.content = sourceEntry.content;
    }

    const afterEntry = state.currentManuscript.entries.get(target.entityId);
    if (afterEntry?.type !== "chapter") {
      throw new Error(`Manuscript chapter is missing after restore: ${target.entityId}`);
    }
    persistAndEmit(state, false, {
      source: "restore",
      title: `恢复章节至提交 ${shortHash}`,
      groupKey: `restore:entity:commit:${commitHash}:manuscript:${target.entityId}`,
      operations: [
        {
          kind: "restore",
          domain: "manuscript",
          entityId: target.entityId,
          entityKind: "chapter",
          label: afterEntry.title,
          displayPath: afterEntry.displayPath,
          previousPath: beforeEntry?.displayPath ?? null,
          beforeContent,
          afterContent: afterEntry.content,
        },
      ],
    });
    return currentChangesOnlySnapshot(state);
  }

  const source = loadResourcesAtTree(state, commitTree);
  const sourceEntry = source.snapshot.entries.get(target.entityId);
  if (sourceEntry === undefined) {
    throw new Error("此提交中不存在该节点。");
  }
  if (sourceEntry.type !== "file") {
    throw new Error("只能恢复资源文件正文。");
  }

  const beforeEntry = state.currentResources.entries.get(target.entityId);
  const beforeContent = beforeEntry?.type === "file" ? beforeEntry.content : null;
  if (beforeEntry?.type === "file" && beforeEntry.content === sourceEntry.content) {
    return currentChangesOnlySnapshot(state);
  }

  ensureResourceAncestorsFromSource(state, sourceEntry.parentId, source.tree, source.snapshot);

  const existingNode = state.resourceTree.nodes[target.entityId];
  if (existingNode === undefined) {
    const sourceNode = source.tree.nodes[target.entityId];
    if (sourceNode === undefined || sourceNode.type !== "file") {
      throw new Error("此提交中不存在该资源文件。");
    }
    state.resourceTree.nodes[target.entityId] = cloneResourceTreeNode(sourceNode);
    const parent = requireResourceFolder(state, sourceEntry.parentId);
    if (!parent.childIds.includes(target.entityId)) {
      parent.childIds.splice(
        clampChildIndex(sourceEntry.index, parent.childIds.length),
        0,
        target.entityId,
      );
    }
    rebuildCurrentResourcesFromTree(state, new Map([[target.entityId, sourceEntry.content]]));
  } else if (existingNode.type !== "file") {
    throw new Error("当前节点不是资源文件，无法恢复正文。");
  } else {
    const entry = state.currentResources.entries.get(target.entityId);
    if (entry?.type !== "file") {
      throw new Error(`Resource file is missing: ${target.entityId}`);
    }
    entry.content = sourceEntry.content;
  }

  const afterEntry = state.currentResources.entries.get(target.entityId);
  if (afterEntry?.type !== "file") {
    throw new Error(`Resource file is missing after restore: ${target.entityId}`);
  }
  persistAndEmit(state, false, {
    source: "restore",
    title: `恢复文件至提交 ${shortHash}`,
    groupKey: `restore:entity:commit:${commitHash}:resource:${target.entityId}`,
    operations: [
      {
        kind: "restore",
        domain: "resource",
        entityId: target.entityId,
        entityKind: "file",
        label: afterEntry.name,
        displayPath: afterEntry.displayPath,
        previousPath: beforeEntry?.displayPath ?? null,
        beforeContent,
        afterContent: afterEntry.content,
      },
    ],
  });
  return currentChangesOnlySnapshot(state);
}

/**
 * Restore one leaf entity from a journal history entry's after-content.
 * Requires the entity to still exist in the current draft.
 */
export function restoreEntityFromHistoryEntry(
  state: WorktreeSessionState,
  entryId: string,
): ChangesSnapshot {
  const journalEntryId = parseJournalHistoryEntryId(entryId);
  if (journalEntryId === null) {
    throw new Error(`Unknown history entry: ${entryId}`);
  }

  const historyEntry = state.store.getJournalHistoryEntry(
    state.projectId,
    state.branchName,
    journalEntryId,
  );
  if (historyEntry === null) {
    throw new Error(`Unknown journal history entry: ${entryId}`);
  }
  if (historyEntry.afterContent === null) {
    throw new Error("此记录没有可恢复内容。");
  }

  const nextContent = historyEntry.afterContent.toString("utf-8");

  if (historyEntry.domain === "manuscript") {
    const entry = state.currentManuscript.entries.get(historyEntry.entityId);
    if (entry?.type !== "chapter") {
      throw new Error("当前草稿中不存在该章节，无法整文件恢复。");
    }
    if (entry.content === nextContent) {
      return currentChangesOnlySnapshot(state);
    }
    const beforeContent = entry.content;
    entry.content = nextContent;
    persistAndEmit(state, false, {
      source: "restore",
      title: "恢复历史版本",
      groupKey: `restore:entity:history:${historyEntry.entityId}`,
      operations: [
        {
          kind: "restore",
          domain: "manuscript",
          entityId: historyEntry.entityId,
          entityKind: "chapter",
          label: entry.title,
          displayPath: entry.displayPath,
          beforeContent,
          afterContent: nextContent,
        },
      ],
    });
    return currentChangesOnlySnapshot(state);
  }

  const entry = state.currentResources.entries.get(historyEntry.entityId);
  if (entry?.type !== "file") {
    throw new Error("当前草稿中不存在该资源文件，无法整文件恢复。");
  }
  if (entry.content === nextContent) {
    return currentChangesOnlySnapshot(state);
  }
  const beforeContent = entry.content;
  entry.content = nextContent;
  persistAndEmit(state, false, {
    source: "restore",
    title: "恢复历史版本",
    groupKey: `restore:entity:history:${historyEntry.entityId}`,
    operations: [
      {
        kind: "restore",
        domain: "resource",
        entityId: historyEntry.entityId,
        entityKind: "file",
        label: entry.name,
        displayPath: entry.displayPath,
        beforeContent,
        afterContent: nextContent,
      },
    ],
  });
  return currentChangesOnlySnapshot(state);
}
