import type { ResourceNode } from "@shared/rpc/projects-rpc";

import type { ResourceTreeNode } from "../resource-tree";

export type CreatingState = {
  id: number;
  kind: "file" | "folder";
  parentPath: string;
};

export type ResourceTreeSelection = {
  path: string;
  type: ResourceNode["type"];
};

export type ResourceTreeUiState = {
  selected: ResourceTreeSelection | null;
  creating: CreatingState | null;
  expandRequest: string | null;
};

export type ResourceTreeDataState = {
  roots: ResourceTreeNode[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  /** 目录 path → 需要重新 ls 并合并展开态 */
  reloadPaths: string[];
};

export const initialResourceTreeUiState: ResourceTreeUiState = {
  selected: null,
  creating: null,
  expandRequest: null,
};

export const initialResourceTreeDataState: ResourceTreeDataState = {
  roots: [],
  status: "idle",
  error: null,
  reloadPaths: [],
};
