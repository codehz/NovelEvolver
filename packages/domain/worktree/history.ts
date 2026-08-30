import type { Change, ChangeTextComparison } from "./changes";
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
