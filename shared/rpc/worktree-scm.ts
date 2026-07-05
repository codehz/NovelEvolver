import type { RpcTarget } from "capnweb";

import type { RpcSubscriptionStream } from "./stream";

export type ScmChangeStats = {
  added: number;
  removed: number;
};

export type ScmChangeDomain = "manuscript" | "resource";
export type ScmChangeKind = "create" | "delete" | "rename" | "move" | "reorder" | "content";
export type ScmEntityKind = "chapter" | "folder" | "file";

type ScmChangeBase = {
  id: string;
  domain: ScmChangeDomain;
  kind: ScmChangeKind;
  entityId: string;
  entityKind: ScmEntityKind;
  label: string;
  displayPath: string;
  depth: number;
  stats?: ScmChangeStats;
};

export type ScmCreateChange = ScmChangeBase & {
  kind: "create";
};

export type ScmDeleteChange = ScmChangeBase & {
  kind: "delete";
};

export type ScmRenameChange = ScmChangeBase & {
  kind: "rename";
  previousLabel: string;
};

export type ScmMoveChange = ScmChangeBase & {
  kind: "move";
  previousPath: string;
};

export type ScmReorderChange = ScmChangeBase & {
  kind: "reorder";
  previousPath: string;
};

export type ScmContentChange = ScmChangeBase & {
  kind: "content";
};

export type ScmChange =
  | ScmCreateChange
  | ScmDeleteChange
  | ScmRenameChange
  | ScmMoveChange
  | ScmReorderChange
  | ScmContentChange;

export type ScmSnapshot = {
  revision: number;
  baseTree: string;
  hasChanges: boolean;
  warning: string | null;
  manuscriptChanges: ScmChange[];
  resourceChanges: ScmChange[];
};

export interface WorktreeScmHandle extends RpcTarget {
  subscribeSnapshot(): RpcSubscriptionStream<ScmSnapshot>;
  revertChange(changeId: string): ScmSnapshot;
  commit(message: string, author: { name: string; email: string }): ScmSnapshot;
}
