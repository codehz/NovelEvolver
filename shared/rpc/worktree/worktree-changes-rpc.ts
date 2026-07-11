import type { RpcTarget } from "capnweb";

import type { RpcSubscriptionResult } from "../transport/stream";
import type {
  ManuscriptTreeDelta,
  ManuscriptTreeSnapshot,
  ResourceTreeDelta,
  ResourceTreeSnapshot,
} from "./worktree-tree-rpc";

export type ChangeDomain = "manuscript" | "resource";
export type ChangeKind = "create" | "delete" | "rename" | "move" | "reorder" | "content";
export type LeafEntityKind = "chapter" | "file";
export type EntityKind = LeafEntityKind | "folder";

export type ChangeStats = {
  added: number;
  removed: number;
};

export type ChangeTextComparisonTarget = {
  domain: ChangeDomain;
  entityId: string;
};

export type ChangeTextComparison = {
  target: ChangeTextComparisonTarget;
  changeId: string;
  kind: ChangeKind;
  label: string;
  displayPath: string;
  originalContent: string;
  currentContent: string;
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

export type ChangesSnapshotEvent = {
  kind: "snapshot";
  snapshot: ChangesSnapshot;
  treeSnapshot: {
    manuscript: ManuscriptTreeSnapshot;
    resources: ResourceTreeSnapshot;
  };
};

/** Snapshot-first feed: 首包为 snapshot（整树）；后续 delta 仅携带树 patch。 */
export type ChangesTreeDelta = {
  manuscript?: ManuscriptTreeDelta;
  resources?: ResourceTreeDelta;
};

export type ChangesDeltaEvent = {
  kind: "delta";
  delta: ChangesDelta;
  treeDelta?: ChangesTreeDelta;
};

export type ChangesEvent = ChangesSnapshotEvent | ChangesDeltaEvent;

export interface WorktreeChangesHandle extends RpcTarget {
  subscribeChanges(): RpcSubscriptionResult<ChangesEvent>;
  revertChange(changeId: string): ChangesSnapshot;
  readChangeTextComparison(changeId: string): ChangeTextComparison;
  readChangeTextComparisonByTarget(target: ChangeTextComparisonTarget): ChangeTextComparison;
  restoreChangeTextHunk(
    target: ChangeTextComparisonTarget,
    expectedContent: string,
    nextContent: string,
  ): void;
  commit(message: string, author: { name: string; email: string }): ChangesSnapshot;
}
