import type { SHA1 } from "nano-git";

import type {
  Change,
  ChangeTextComparison,
  ChangeTextComparisonTarget,
  ChangesEvent,
  ChangesSnapshot,
} from "#shared/rpc/worktree/index";

import type { JournalEntitySnapshot } from "../journal/journal-types";
import { cloneResourceSnapshotState } from "../snapshots/resource";
import {
  cloneManuscriptSnapshotState,
  cloneManuscriptTreeSnapshot,
  cloneResourceTreeSnapshot,
} from "../trees/tree-clone";
import { currentChangesOnlySnapshot, currentChangesSnapshot } from "./changes-snapshot";
import { resetChangesStreamBaseline } from "./changes-snapshot";
import { writeCurrentTreeToRepo } from "./git-sync";
import { journalContentForChange, persistAndEmit } from "./persistence";
import { journalCaptureFromChangesSnapshot } from "./persistence";
import {
  revertManuscriptChange,
  revertResourceChange,
  restoreManuscriptSubtreeFromBase,
  restoreResourceSubtreeFromBase,
} from "./revert";
import type { WorktreeSessionState } from "./state";

export function subscribeChanges(state: WorktreeSessionState): ReadableStream<ChangesEvent> {
  return state.changesPublisher.subscribe({
    getInitialValue: () => currentChangesSnapshot(state),
  });
}

export function requireChange(state: WorktreeSessionState, changeId: string): Change {
  const snapshot = currentChangesOnlySnapshot(state);
  const change = [...snapshot.manuscriptChanges, ...snapshot.resourceChanges].find(
    (candidate) => candidate.id === changeId,
  );
  if (change === undefined) {
    throw new Error(`Unknown change: ${changeId}`);
  }
  return change;
}

export function requireTextComparisonChangeByTarget(
  state: WorktreeSessionState,
  target: ChangeTextComparisonTarget,
): Change {
  const snapshot = currentChangesOnlySnapshot(state);
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

export function buildChangeTextComparison(
  state: WorktreeSessionState,
  change: Change,
): ChangeTextComparison {
  const { originalContent, currentContent } = requireTextComparisonContent(state, change);
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

export function requireTextComparisonContent(
  state: WorktreeSessionState,
  change: Change,
): {
  originalContent: string;
  currentContent: string;
} {
  if (change.kind !== "create" && change.kind !== "delete" && change.kind !== "content") {
    throw new Error("此类变更暂不支持文本差异预览。");
  }
  if (change.entityKind !== "chapter" && change.entityKind !== "file") {
    throw new Error("只有文本叶子节点支持差异预览。");
  }

  const originalContent = journalContentForChange(state, change, "before");
  const currentContent = journalContentForChange(state, change, "after");

  return {
    originalContent: originalContent ?? "",
    currentContent: currentContent ?? "",
  };
}

export function restoreManuscriptTextHunk(
  state: WorktreeSessionState,
  change: Change,
  expectedContent: string,
  nextContent: string,
): void {
  if (change.entityKind !== "chapter") {
    throw new Error("Only manuscript chapter changes support text restore.");
  }

  if (change.kind === "delete") {
    restoreManuscriptSubtreeFromBase(state, change.entityId);
    const restoredEntry = state.currentManuscript.entries.get(change.entityId);
    if (restoredEntry?.type !== "chapter") {
      throw new Error(`Manuscript chapter is missing: ${change.entityId}`);
    }
    restoredEntry.content = nextContent;
  } else {
    const entry = state.currentManuscript.entries.get(change.entityId);
    if (entry?.type !== "chapter") {
      throw new Error(`Manuscript chapter is missing: ${change.entityId}`);
    }
    entry.content = nextContent;
  }

  persistAndEmit(state, false, {
    source: "restore",
    title: "局部恢复",
    groupKey: `restore:hunk:${change.domain}:${change.entityId}`,
    operations: [
      {
        kind: "restore",
        domain: change.domain,
        entityId: change.entityId,
        entityKind: "chapter",
        label: state.currentManuscript.entries.get(change.entityId)?.title ?? change.label,
        displayPath:
          state.currentManuscript.entries.get(change.entityId)?.displayPath ?? change.displayPath,
        beforeContent: expectedContent,
        afterContent: nextContent,
      },
    ],
  });
}

export function restoreResourceTextHunk(
  state: WorktreeSessionState,
  change: Change,
  expectedContent: string,
  nextContent: string,
): void {
  if (change.entityKind !== "file") {
    throw new Error("Only resource file changes support text restore.");
  }

  if (change.kind === "delete") {
    restoreResourceSubtreeFromBase(state, change.entityId);
    const restoredEntry = state.currentResources.entries.get(change.entityId);
    if (restoredEntry?.type !== "file") {
      throw new Error(`Resource file is missing: ${change.entityId}`);
    }
    restoredEntry.content = nextContent;
  } else {
    const entry = state.currentResources.entries.get(change.entityId);
    if (entry?.type !== "file") {
      throw new Error(`Resource file is missing: ${change.entityId}`);
    }
    entry.content = nextContent;
  }

  persistAndEmit(state, false, {
    source: "restore",
    title: "局部恢复",
    groupKey: `restore:hunk:${change.domain}:${change.entityId}`,
    operations: [
      {
        kind: "restore",
        domain: change.domain,
        entityId: change.entityId,
        entityKind: "file",
        label: state.currentResources.entries.get(change.entityId)?.name ?? change.label,
        displayPath:
          state.currentResources.entries.get(change.entityId)?.displayPath ?? change.displayPath,
        beforeContent: expectedContent,
        afterContent: nextContent,
      },
    ],
  });
}

export function currentJournalEntitySnapshot(
  state: WorktreeSessionState,
  change: Change,
): JournalEntitySnapshot | null {
  if (change.domain === "manuscript") {
    const entry = state.currentManuscript.entries.get(change.entityId);
    if (entry === undefined) {
      return null;
    }
    return {
      label: entry.title,
      displayPath: entry.displayPath,
      content: entry.type === "chapter" ? entry.content : null,
    };
  }

  const entry = state.currentResources.entries.get(change.entityId);
  if (entry === undefined) {
    return null;
  }
  return {
    label: entry.name,
    displayPath: entry.displayPath,
    content: entry.type === "file" ? entry.content : null,
  };
}

export function revertChange(state: WorktreeSessionState, changeId: string): ChangesSnapshot {
  const change = requireChange(state, changeId);

  const beforeRestore = currentJournalEntitySnapshot(state, change);
  const [domain, kind, entityId] = changeId.split(":", 3);
  if (domain === "manuscript") {
    revertManuscriptChange(state, kind, entityId);
  } else if (domain === "resource") {
    revertResourceChange(state, kind, entityId);
  } else {
    throw new Error(`Unsupported change domain: ${domain}`);
  }

  const afterRestore = currentJournalEntitySnapshot(state, change);
  persistAndEmit(state, false, {
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
        displayPath: afterRestore?.displayPath ?? beforeRestore?.displayPath ?? change.displayPath,
        previousPath: beforeRestore?.displayPath ?? null,
        beforeContent: beforeRestore?.content ?? null,
        afterContent: afterRestore?.content ?? null,
      },
    ],
  });
  return currentChangesOnlySnapshot(state);
}

/**
 * Atomically restore the full working tree to base.
 * Prefer this over looping `revertChange` — parent/child create/delete order is unsafe.
 */
export function revertAllChanges(state: WorktreeSessionState): ChangesSnapshot {
  const snapshot = currentChangesOnlySnapshot(state);
  if (!snapshot.hasChanges) {
    return snapshot;
  }

  const changes = [...snapshot.manuscriptChanges, ...snapshot.resourceChanges];
  const beforeByChangeId = new Map(
    changes.map((change) => [change.id, currentJournalEntitySnapshot(state, change)] as const),
  );

  state.manuscriptTree = cloneManuscriptTreeSnapshot(state.baseManuscriptTree);
  state.resourceTree = cloneResourceTreeSnapshot(state.baseResourceTree);
  state.currentManuscript = cloneManuscriptSnapshotState(state.baseManuscript);
  state.currentResources = cloneResourceSnapshotState(state.baseResources);
  state.changeTracker.clearCache();

  persistAndEmit(state, false, {
    source: "restore",
    title: "还原所有更改",
    groupKey: "restore:all",
    operations: changes.map((change) => {
      const beforeRestore = beforeByChangeId.get(change.id) ?? null;
      const afterRestore = currentJournalEntitySnapshot(state, change);
      return {
        kind: "restore" as const,
        domain: change.domain,
        entityId: change.entityId,
        entityKind: change.entityKind,
        label: afterRestore?.label ?? beforeRestore?.label ?? change.label,
        displayPath: afterRestore?.displayPath ?? beforeRestore?.displayPath ?? change.displayPath,
        previousPath: beforeRestore?.displayPath ?? null,
        beforeContent: beforeRestore?.content ?? null,
        afterContent: afterRestore?.content ?? null,
      };
    }),
  });
  return currentChangesOnlySnapshot(state);
}

export function readChangeTextComparison(
  state: WorktreeSessionState,
  changeId: string,
): ChangeTextComparison {
  const change = requireChange(state, changeId);
  return buildChangeTextComparison(state, change);
}

export function readChangeTextComparisonByTarget(
  state: WorktreeSessionState,
  target: ChangeTextComparisonTarget,
): ChangeTextComparison {
  return buildChangeTextComparison(state, requireTextComparisonChangeByTarget(state, target));
}

export function restoreChangeTextHunk(
  state: WorktreeSessionState,
  target: ChangeTextComparisonTarget,
  expectedContent: string,
  nextContent: string,
): void {
  const change = requireTextComparisonChangeByTarget(state, target);
  const { currentContent } = requireTextComparisonContent(state, change);
  if (currentContent !== expectedContent) {
    throw new Error("当前内容已变化，请重新打开差异预览后再试。");
  }
  if (currentContent === nextContent) {
    return;
  }

  if (change.domain === "manuscript") {
    restoreManuscriptTextHunk(state, change, expectedContent, nextContent);
  } else {
    restoreResourceTextHunk(state, change, expectedContent, nextContent);
  }
}

export function commitChanges(
  state: WorktreeSessionState,
  message: string,
  author: { name: string; email: string },
): ChangesSnapshot {
  const snapshotBeforeCommit = currentChangesOnlySnapshot(state);
  const tree = writeCurrentTreeToRepo(state);
  const parentCommit = state.repo.readBranch(state.branchName);
  const parents: SHA1[] = parentCommit !== null ? [parentCommit] : [];
  const now = Math.floor(Date.now() / 1000);
  const gitAuthor = { name: author.name, email: author.email, timestamp: now, timezone: "+0000" };
  const commitHash = state.repo.createCommit(tree, parents, message, gitAuthor);
  const journalCapture = journalCaptureFromChangesSnapshot(
    state,
    snapshotBeforeCommit,
    message,
    commitHash,
  );

  state.repo.updateRef(`refs/heads/${state.branchName}`, commitHash);
  state.baseCommitSha = commitHash;
  state.baseManuscriptTree = cloneManuscriptTreeSnapshot(state.manuscriptTree);
  state.baseResourceTree = cloneResourceTreeSnapshot(state.resourceTree);
  state.baseManuscript = cloneManuscriptSnapshotState(state.currentManuscript);
  state.baseResources = cloneResourceSnapshotState(state.currentResources);
  state.changeTracker.clearCache();
  resetChangesStreamBaseline(state);
  persistAndEmit(state, true, journalCapture);
  return currentChangesOnlySnapshot(state);
}
