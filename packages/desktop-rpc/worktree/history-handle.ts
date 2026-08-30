import type { RpcTarget } from "capnweb";

import type { ChangeTextComparisonTarget, ChangesSnapshot } from "#domain/worktree/changes";
import type {
  CommitChangeTextComparison,
  CommitChangesSnapshot,
  CommitSummary,
  HistoryEntry,
  HistoryEntryContent,
  HistoryTarget,
} from "#domain/worktree/history";

export interface HistoryHandle extends RpcTarget {
  listCommits(maxCount?: number): CommitSummary[];
  listCommitChanges(commitHash: string): CommitChangesSnapshot;
  readCommitChangeTextComparison(
    commitHash: string,
    target: ChangeTextComparisonTarget,
  ): CommitChangeTextComparison;
  listFileHistory(target: HistoryTarget, limit?: number): HistoryEntry[];
  readHistoryEntryContent(entryId: string): HistoryEntryContent;
  restoreHistoryEntryContentHunk(
    entryId: string,
    expectedContent: string,
    nextContent: string,
  ): void;
  /**
   * Restore the full working-tree draft from `commitHash` (restore-into-draft).
   * Does **not** move the branch tip or base snapshot; pending changes reflect
   * the diff against the current tip base.
   */
  restoreWorkingTreeFromCommit(commitHash: string): ChangesSnapshot;
  /**
   * Restore a single leaf entity (chapter/file) from `commitHash` into the draft.
   * Recreates the node when it exists in that commit but is missing now.
   * Does **not** move the branch tip.
   */
  restoreEntityFromCommit(commitHash: string, target: HistoryTarget): ChangesSnapshot;
  /**
   * Restore a single leaf entity from a journal history entry's after-content
   * into the draft. Requires the entry to have recoverable content and the
   * entity to still exist in the current draft.
   */
  restoreEntityFromHistoryEntry(entryId: string): ChangesSnapshot;
}
