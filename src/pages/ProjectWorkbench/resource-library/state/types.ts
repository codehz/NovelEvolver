import type { ResourceNode } from "@shared/rpc/projects-rpc";

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

export type DirListingState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; entries: ResourceNode[] }
  | { status: "error"; message: string };

/** 规范化树状态：展开集合 + 各目录 ls 缓存（path `""` 为根）。 */
export type ResourceTreeDataState = {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  expandedPaths: Record<string, true>;
  listings: Record<string, DirListingState>;
  reloadPaths: string[];
};

export const initialResourceTreeUiState: ResourceTreeUiState = {
  selected: null,
  creating: null,
  expandRequest: null,
};

export const initialResourceTreeDataState: ResourceTreeDataState = {
  status: "idle",
  error: null,
  expandedPaths: {},
  listings: {},
  reloadPaths: [],
};
