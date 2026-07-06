import type { RpcTarget } from "capnweb";

export type TimelineDomain = "manuscript" | "resource";

export type TimelineTarget =
  | {
      domain: "manuscript";
      entityId: string;
    }
  | {
      domain: "resource";
      entityId: string;
    };

export type TimelineEntrySource = "journal" | "commit";

export type TimelineEntryKind =
  | "create"
  | "delete"
  | "rename"
  | "move"
  | "reorder"
  | "content"
  | "restore";

export type TimelineEntryActor = "user" | "system";

export type TimelineEntryRevisionSource =
  | "autosave"
  | "manual-checkpoint"
  | "structure-edit"
  | "restore"
  | "commit"
  | "import";

export type TimelineEntryStats = {
  added: number;
  removed: number;
};

export type TimelineEntry = {
  id: string;
  source: TimelineEntrySource;
  revisionSource?: TimelineEntryRevisionSource;
  actor?: TimelineEntryActor;
  kind: TimelineEntryKind;
  domain: TimelineDomain;
  entityId: string;
  label: string;
  displayPath: string;
  timestamp: number;
  message: string;
  stats?: TimelineEntryStats;
  commitHash?: string;
  shortHash?: string;
  authorName?: string;
  revisionId?: string;
  operationId?: string;
  groupId?: string;
  hasContent: boolean;
};

export type TimelineEntryContent = {
  content: string | null;
  beforeContent?: string | null;
};

export interface WorktreeTimelineHandle extends RpcTarget {
  listFileTimeline(target: TimelineTarget, limit?: number): TimelineEntry[];
  readTimelineEntryContent(entryId: string): TimelineEntryContent;
}
