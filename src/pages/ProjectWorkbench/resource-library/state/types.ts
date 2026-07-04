import type { ResourceNode, ResourceTreeSnapshot } from "#shared/rpc/projects-rpc";

import type { TreeResolvedDrop } from "../../tree/tree-drag";

export type CreatingState = {
  mode: "creating";
  id: number;
  kind: "file" | "folder";
  parentPath: string;
};

export type RenamingState = {
  mode: "renaming";
  path: string;
  kind: "file" | "folder";
};

export type ResourceTreeEditingState = CreatingState | RenamingState;

export type ResourceTreeSelection = {
  path: string;
  type: ResourceNode["type"];
};

export type ResourceTreeDragState = {
  sourcePath: string;
  sourceType: ResourceNode["type"];
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
