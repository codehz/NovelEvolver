import type { RpcTarget } from "capnweb";

export type HistoryDomain = "manuscript" | "resource";

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
  | "import";

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

export interface HistoryHandle extends RpcTarget {
  listCommits(maxCount?: number): CommitSummary[];
  listFileHistory(target: HistoryTarget, limit?: number): HistoryEntry[];
  readHistoryEntryContent(entryId: string): HistoryEntryContent;
  restoreHistoryEntryContentHunk(
    entryId: string,
    expectedContent: string,
    nextContent: string,
  ): void;
}
