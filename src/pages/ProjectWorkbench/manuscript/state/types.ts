import type { ManuscriptTreeNode, ManuscriptTreeSnapshot } from "#shared/rpc/worktree-tree";

import type { TreeResolvedDrop } from "../../tree/tree-drag";

export type ManuscriptCreatingState = {
  mode: "creating";
  id: number;
  kind: ManuscriptTreeNode["type"];
  parentId: string;
  index: number;
};

export type ManuscriptRenamingState = {
  mode: "renaming";
  id: string;
  kind: ManuscriptTreeNode["type"];
};

export type ManuscriptEditingState = ManuscriptCreatingState | ManuscriptRenamingState;

export type ManuscriptMoveTarget =
  | { kind: "into"; parentId: string }
  | { kind: "insert"; parentId: string; index: number };

export type ManuscriptDragState = {
  sourceId: string;
  sourceType: ManuscriptTreeNode["type"];
  resolved: TreeResolvedDrop<ManuscriptMoveTarget> | null;
};

export type ManuscriptTreeState = {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  snapshot: ManuscriptTreeSnapshot | null;
  expandedIds: Record<string, true>;
  selectedId: string | null;
  editing: ManuscriptEditingState | null;
  drag: ManuscriptDragState | null;
  nextEditingId: number;
};

export const initialManuscriptTreeState: ManuscriptTreeState = {
  status: "idle",
  error: null,
  snapshot: null,
  expandedIds: { root: true },
  selectedId: null,
  editing: null,
  drag: null,
  nextEditingId: 1,
};
