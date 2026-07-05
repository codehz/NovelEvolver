import type { ResourceTreeNode, ResourceTreeSnapshot } from "#shared/rpc/worktree-tree";

import type { TreeResolvedDrop } from "../../tree/tree-drag";

export type CreatingState = {
  mode: "creating";
  id: number;
  kind: "file" | "folder";
  parentId: string;
};

export type RenamingState = {
  mode: "renaming";
  id: string;
  kind: "file" | "folder";
};

export type ResourceTreeEditingState = CreatingState | RenamingState;

export type ResourceTreeSelection = {
  id: string;
  type: ResourceTreeNode["type"];
};

export type ResourceTreeDragState = {
  sourceId: string;
  sourceType: ResourceTreeNode["type"];
  resolved: TreeResolvedDrop<string> | null;
};

export type ResourceTreeState = {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  snapshot: ResourceTreeSnapshot | null;
  expandedPaths: Record<string, true>;
  selected: ResourceTreeSelection | null;
  editing: ResourceTreeEditingState | null;
  drag: ResourceTreeDragState | null;
  nodeVisualIds: Record<string, string>;
  nextVisualId: number;
};

export const initialResourceTreeState: ResourceTreeState = {
  status: "idle",
  error: null,
  snapshot: null,
  expandedPaths: {},
  selected: null,
  editing: null,
  drag: null,
  nodeVisualIds: {},
  nextVisualId: 1,
};
