import type { RpcTarget } from "capnweb";

import type {
  Change,
  ChangeTextComparison,
  ChangeTextComparisonTarget,
  ChangesSnapshot,
} from "./worktree-changes-rpc";
import type { WorktreeDomain } from "./worktree-domain";

/** @deprecated Prefer {@link WorktreeDomain}. */
export type HistoryDomain = WorktreeDomain;

export type HistoryTarget =
  | {
      domain: "manuscript";
      entityId: string;
    }
  | {
      domain: "resource";
      entityId: string;
    };

export type HistoryEntrySource = "journal";

export type HistoryEntryKind =
  | "create"
  | "delete"
  | "rename"
  | "move"
  | "reorder"
  | "content"
  | "restore";

export type HistoryEntryActor = "user" | "system";

export type HistoryEntryRevisionSource =
  | "autosave"
  | "manual-checkpoint"
  | "structure-edit"
  | "restore"
  | "commit"
  | "import"
  | "search-replace";

export type HistoryEntryStats = {
  added: number;
  removed: number;
};

export type HistoryEntry = {
  id: string;
  source: HistoryEntrySource;
  revisionSource?: HistoryEntryRevisionSource;
  actor?: HistoryEntryActor;
  kind: HistoryEntryKind;
  domain: HistoryDomain;
  entityId: string;
  label: string;
  displayPath: string;
  timestamp: number;
  message: string;
  stats?: HistoryEntryStats;
  commitHash?: string;
  shortHash?: string;
  authorName?: string;
  revisionId?: string;
  operationId?: string;
  groupId?: string;
  hasContent: boolean;
};

export type HistoryEntryContent = {
  content: string | null;
  beforeContent?: string | null;
};

export type CommitSummary = {
  hash: string;
  shortHash: string;
  message: string;
  authorName: string;
  committedAt: number;
};

export type CommitChangesSnapshot = {
  commitHash: string;
  parentHash: string | null;
  manuscriptChanges: Change[];
  resourceChanges: Change[];
};

/** Parent→commit text comparison; same shape as pending-change comparison. */
export type CommitChangeTextComparison = ChangeTextComparison;

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
