import type { RpcTarget } from "capnweb";

import type { RpcSubscriptionStream } from "./stream";
import type { ManuscriptTreeSnapshot, ResourceTreeSnapshot } from "./worktree-tree";

export type ChangeDomain = "manuscript" | "resource";
export type ChangeKind = "create" | "delete" | "rename" | "move" | "reorder" | "content";
export type EntityKind = "chapter" | "folder" | "file";

export type ChangeStats = {
  added: number;
  removed: number;
};

type ChangeBase = {
  id: string;
  domain: ChangeDomain;
  kind: ChangeKind;
  entityId: string;
  entityKind: EntityKind;
  label: string;
  displayPath: string;
  depth: number;
  order: number;
  stats?: ChangeStats;
};

export type CreateChange = ChangeBase & {
  kind: "create";
};

export type DeleteChange = ChangeBase & {
  kind: "delete";
};

export type RenameChange = ChangeBase & {
  kind: "rename";
  previousLabel: string;
};

export type MoveChange = ChangeBase & {
  kind: "move";
  previousPath: string;
};

export type ReorderChange = ChangeBase & {
  kind: "reorder";
  previousPath: string;
};

export type ContentChange = ChangeBase & {
  kind: "content";
};

export type Change =
  | CreateChange
  | DeleteChange
  | RenameChange
  | MoveChange
  | ReorderChange
  | ContentChange;

export type ChangesSnapshot = {
  revision: number;
  baseTree: string;
  hasChanges: boolean;
  warning: string | null;
  manuscriptChanges: Change[];
  resourceChanges: Change[];
};

export type ChangesDelta = {
  fromRevision: number;
  toRevision: number;
  addedChanges: Change[];
  removedChangeIds: string[];
};

export type WorktreeChangesSnapshotEvent = {
  kind: "snapshot";
  snapshot: ChangesSnapshot;
  treeSnapshot: {
    manuscript: ManuscriptTreeSnapshot;
    resources: ResourceTreeSnapshot;
  };
};

export type WorktreeChangesDeltaEvent = {
  kind: "delta";
  delta: ChangesDelta;
  treeDelta?: {
    manuscript?: ManuscriptTreeSnapshot;
    resources?: ResourceTreeSnapshot;
  };
};

export type WorktreeChangesEvent = WorktreeChangesSnapshotEvent | WorktreeChangesDeltaEvent;

export interface WorktreeChangesHandle extends RpcTarget {
  subscribe(): RpcSubscriptionStream<WorktreeChangesEvent>;
  revertChange(changeId: string): ChangesSnapshot;
  commit(message: string, author: { name: string; email: string }): ChangesSnapshot;
  listCommits(maxCount?: number): {
    hash: string;
    shortHash: string;
    message: string;
    authorName: string;
    committedAt: number;
  }[];
}
