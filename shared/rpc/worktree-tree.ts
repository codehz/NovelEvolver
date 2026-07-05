import type { RpcTarget } from "capnweb";

import type { RpcSubscriptionStream } from "./stream";

export type ManuscriptTreeNodeType = "folder" | "chapter";
export type ResourceTreeNodeType = "folder" | "file";

/** 文件/章节相对于分支基线的变更状态（仅增加和修改，删除节点不在树中）。 */
export type FileChangeStatus = "added" | "modified";

export type ManuscriptTreeNode = {
  id: string;
  type: ManuscriptTreeNodeType;
  title: string;
  parentId: string | null;
  childIds: string[];
  /** 相对基线的变更状态 */
  changeStatus?: FileChangeStatus;
};

export type ResourceTreeNode = {
  id: string;
  type: ResourceTreeNodeType;
  name: string;
  parentId: string | null;
  childIds: string[];
  /** 相对基线的变更状态 */
  changeStatus?: FileChangeStatus;
};

export type ManuscriptTreeSnapshot = {
  rootId: "root";
  nodes: Record<string, ManuscriptTreeNode>;
};

export type ResourceTreeSnapshot = {
  rootId: string;
  nodes: Record<string, ResourceTreeNode>;
};

export type TreeChildrenPatch = {
  parentId: string;
  childIds: string[];
};

export type ManuscriptTreeDelta = {
  putNodes: Record<string, ManuscriptTreeNode>;
  deleteNodeIds: string[];
  setChildren: TreeChildrenPatch[];
};

export type ResourceTreeDelta = {
  putNodes: Record<string, ResourceTreeNode>;
  deleteNodeIds: string[];
  setChildren: TreeChildrenPatch[];
};

export type WorktreeTreeSnapshot = {
  revision: number;
  manuscript: ManuscriptTreeSnapshot;
  resources: ResourceTreeSnapshot;
};

export type WorktreeTreeSnapshotEvent = {
  kind: "snapshot";
  snapshot: WorktreeTreeSnapshot;
};

export type WorktreeTreeDeltaEvent = {
  kind: "delta";
  fromRevision: number;
  toRevision: number;
  manuscript?: ManuscriptTreeDelta;
  resources?: ResourceTreeDelta;
};

export type WorktreeTreeEvent = WorktreeTreeSnapshotEvent | WorktreeTreeDeltaEvent;

export interface WorktreeTreeHandle extends RpcTarget {
  subscribe(): RpcSubscriptionStream<WorktreeTreeEvent>;
}
