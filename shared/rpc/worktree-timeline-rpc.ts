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

export type TimelineEntrySource = "local-snapshot" | "commit";

export type TimelineEntryKind = "create" | "delete" | "rename" | "move" | "content";

export type TimelineEntryStats = {
  added: number;
  removed: number;
};

export type TimelineEntry = {
  id: string;
  source: TimelineEntrySource;
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
  hasContent: boolean;
};

export type TimelineEntryContent = {
  content: string | null;
};

export interface WorktreeTimelineHandle extends RpcTarget {
  listFileTimeline(target: TimelineTarget, limit?: number): TimelineEntry[];
  readTimelineEntryContent(entryId: string): TimelineEntryContent;
}
