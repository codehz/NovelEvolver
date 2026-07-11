import { nanoid } from "nanoid";

import type { Change, ChangesSnapshot } from "#shared/rpc/worktree/index";

import type {
  ManuscriptNodeCommittedRow,
  ManuscriptNodeCurrentRow,
  ResourceNodeCommittedRow,
  ResourceNodeCurrentRow,
  WorktreeJournalEntryRecord,
  WorktreeJournalSource,
} from "../../db/repositories/worktree-repo";
import { computeStats } from "../git/diff-utils";
import { sha1Text } from "../journal/journal-types";
import type { JournalOperationCapture, JournalRevisionCapture } from "../journal/journal-types";
import { emitChanges } from "./changes-snapshot";
import { recomputeAllChangeStatuses } from "./rebuild";
import { AUTOSAVE_JOURNAL_MERGE_WINDOW_MS, RESTORE_HUNK_JOURNAL_MERGE_WINDOW_MS } from "./state";
import type { WorktreeSessionState } from "./state";

export function persistState(
  state: WorktreeSessionState,
  includeCommitted: boolean,
  journalCapture?: JournalRevisionCapture,
): void {
  state.store.transaction(() => {
    state.store.upsertWorktree({
      projectId: state.projectId,
      branchName: state.branchName,
      baseCommitSha: state.baseCommitSha,
      revision: state.revision,
      warning: state.warning,
    });
    state.store.replaceManuscriptCurrentRows(
      state.projectId,
      state.branchName,
      serializeCurrentManuscriptRows(state),
    );
    state.store.replaceResourceCurrentRows(
      state.projectId,
      state.branchName,
      serializeCurrentResourceRows(state),
    );
    if (includeCommitted) {
      state.store.replaceManuscriptCommittedRows(
        state.projectId,
        state.branchName,
        serializeCommittedManuscriptRows(state),
      );
      state.store.replaceResourceCommittedRows(
        state.projectId,
        state.branchName,
        serializeCommittedResourceRows(state),
      );
    }
    if (journalCapture !== undefined) {
      recordJournalEntries(state, journalCapture);
    }
  });
}

export function persistAndEmit(
  state: WorktreeSessionState,
  includeCommitted = false,
  journalCapture?: JournalRevisionCapture,
): void {
  state.warning = null;
  recomputeAllChangeStatuses(state);
  state.revision += 1;
  persistState(state, includeCommitted, journalCapture);
  emitChanges(state);
}

export function serializeCurrentManuscriptRows(
  state: WorktreeSessionState,
): ManuscriptNodeCurrentRow[] {
  const rows: ManuscriptNodeCurrentRow[] = [];
  const visit = (id: string): void => {
    const node = state.manuscriptTree.nodes[id];
    if (node === undefined) {
      return;
    }
    const parent = node.parentId;
    const sortIndex =
      parent === null ? 0 : (state.manuscriptTree.nodes[parent]?.childIds.indexOf(id) ?? 0);
    rows.push({
      projectId: state.projectId,
      branchName: state.branchName,
      id,
      parentId: parent,
      type: node.type,
      title: node.title,
      sortIndex,
      content:
        node.type === "chapter"
          ? Buffer.from(state.currentManuscript.entries.get(id)?.content ?? "", "utf-8")
          : null,
    });
    if (node.type === "folder") {
      node.childIds.forEach(visit);
    }
  };
  visit(state.manuscriptTree.rootId);
  return rows;
}

export function serializeCommittedManuscriptRows(
  state: WorktreeSessionState,
): ManuscriptNodeCommittedRow[] {
  const rows: ManuscriptNodeCommittedRow[] = [];
  const visit = (id: string): void => {
    const node = state.baseManuscriptTree.nodes[id];
    if (node === undefined) {
      return;
    }
    const parent = node.parentId;
    const sortIndex =
      parent === null ? 0 : (state.baseManuscriptTree.nodes[parent]?.childIds.indexOf(id) ?? 0);
    rows.push({
      projectId: state.projectId,
      branchName: state.branchName,
      id,
      parentId: parent,
      type: node.type,
      title: node.title,
      sortIndex,
      contentSha:
        node.type === "chapter"
          ? state.repo.hashObject(
              Buffer.from(state.baseManuscript.entries.get(id)?.content ?? "", "utf-8"),
            )
          : null,
    });
    if (node.type === "folder") {
      node.childIds.forEach(visit);
    }
  };
  visit(state.baseManuscriptTree.rootId);
  return rows;
}

export function serializeCurrentResourceRows(
  state: WorktreeSessionState,
): ResourceNodeCurrentRow[] {
  const rows: ResourceNodeCurrentRow[] = [];
  const visit = (id: string): void => {
    const node = state.resourceTree.nodes[id];
    if (node === undefined) {
      return;
    }
    const parent = node.parentId;
    rows.push({
      projectId: state.projectId,
      branchName: state.branchName,
      id,
      parentId: parent,
      type: node.type,
      name: node.name,
      content:
        node.type === "file"
          ? Buffer.from(state.currentResources.entries.get(id)?.content ?? "", "utf-8")
          : null,
    });
    if (node.type === "folder") {
      node.childIds.forEach(visit);
    }
  };
  visit(state.resourceTree.rootId);
  return rows;
}

export function serializeCommittedResourceRows(
  state: WorktreeSessionState,
): ResourceNodeCommittedRow[] {
  const rows: ResourceNodeCommittedRow[] = [];
  const visit = (id: string): void => {
    const node = state.baseResourceTree.nodes[id];
    if (node === undefined) {
      return;
    }
    const parent = node.parentId;
    rows.push({
      projectId: state.projectId,
      branchName: state.branchName,
      id,
      parentId: parent,
      type: node.type,
      name: node.name,
      contentSha:
        node.type === "file"
          ? state.repo.hashObject(
              Buffer.from(state.baseResources.entries.get(id)?.content ?? "", "utf-8"),
            )
          : null,
    });
    if (node.type === "folder") {
      node.childIds.forEach(visit);
    }
  };
  visit(state.baseResourceTree.rootId);
  return rows;
}

export function recordJournalEntries(
  state: WorktreeSessionState,
  capture: JournalRevisionCapture,
): void {
  if (capture.operations.length === 0) {
    return;
  }
  const now = Date.now();
  const entries: WorktreeJournalEntryRecord[] = [];

  for (const operation of capture.operations) {
    const beforeContent = journalContentForOperation(state, capture.source, operation, "before");
    const afterContent = journalContentForOperation(state, capture.source, operation, "after");

    const mergeWindowMs =
      capture.source === "autosave" && operation.kind === "content"
        ? AUTOSAVE_JOURNAL_MERGE_WINDOW_MS
        : capture.source === "restore" && operation.kind === "restore"
          ? RESTORE_HUNK_JOURNAL_MERGE_WINDOW_MS
          : null;
    if (mergeWindowMs !== null && capture.groupKey !== null) {
      const existing = state.store.getMergeableJournalEntry(
        state.projectId,
        state.branchName,
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
        const afterBlobId = upsertJournalContentBlob(state, afterContent);
        const stats =
          mergedBeforeContent !== null && afterContent !== null
            ? computeStats(mergedBeforeContent, afterContent)
            : null;
        state.store.updateJournalEntryAfterContent({
          projectId: state.projectId,
          branchName: state.branchName,
          entryId: existing.entryId,
          updatedAt: now,
          worktreeRevision: state.revision,
          label: operation.label,
          displayPath: operation.displayPath,
          afterBlobId,
          statsAdded: stats?.added ?? null,
          statsRemoved: stats?.removed ?? null,
        });
        continue;
      }
    }

    const beforeBlobId = upsertJournalContentBlob(state, beforeContent);
    const afterBlobId = upsertJournalContentBlob(state, afterContent);
    const stats =
      beforeContent !== null && afterContent !== null
        ? computeStats(beforeContent, afterContent)
        : null;
    entries.push({
      projectId: state.projectId,
      branchName: state.branchName,
      entryId: nanoid(12),
      createdAt: now,
      updatedAt: now,
      worktreeRevision: state.revision,
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

  state.store.insertJournalEntries(entries);
}

export function journalContentForOperation(
  state: WorktreeSessionState,
  source: WorktreeJournalSource,
  operation: JournalOperationCapture,
  side: "before" | "after",
): string | null {
  if (operation.kind === "rename" || operation.kind === "move" || operation.kind === "reorder") {
    return null;
  }
  if (source !== "autosave" && operation.kind === "content") {
    return side === "before" ? (operation.beforeContent ?? null) : (operation.afterContent ?? null);
  }
  return side === "before" ? (operation.beforeContent ?? null) : (operation.afterContent ?? null);
}

export function upsertJournalContentBlob(
  state: WorktreeSessionState,
  content: string | null,
): string | null {
  if (content === null) {
    return null;
  }
  const contentSha = sha1Text(content);
  state.store.upsertJournalBlob({
    projectId: state.projectId,
    blobId: contentSha,
    contentSha,
    content: Buffer.from(content, "utf-8"),
  });
  return contentSha;
}

export function journalCaptureFromChangesSnapshot(
  state: WorktreeSessionState,
  snapshot: ChangesSnapshot,
  message: string,
  commitHash: string,
): JournalRevisionCapture | undefined {
  const operations = [...snapshot.manuscriptChanges, ...snapshot.resourceChanges].map((change) =>
    journalOperationFromChange(state, change),
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

export function journalOperationFromChange(
  state: WorktreeSessionState,
  change: Change,
): JournalOperationCapture {
  const beforeContent = journalContentForChange(state, change, "before");
  const afterContent = journalContentForChange(state, change, "after");
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

export function journalContentForChange(
  state: WorktreeSessionState,
  change: Change,
  side: "before" | "after",
): string | null {
  if (change.entityKind !== "chapter" && change.entityKind !== "file") {
    return null;
  }
  if (change.domain === "manuscript") {
    const snapshot = side === "before" ? state.baseManuscript : state.currentManuscript;
    const entry = snapshot.entries.get(change.entityId);
    return entry?.type === "chapter" ? entry.content : null;
  }
  const snapshot = side === "before" ? state.baseResources : state.currentResources;
  const entry = snapshot.entries.get(change.entityId);
  return entry?.type === "file" ? entry.content : null;
}
