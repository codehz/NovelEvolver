import type { ManuscriptNode, ManuscriptOutline } from "#shared/rpc/projects-rpc";

export type ManuscriptCreatingState = {
  mode: "creating";
  id: number;
  kind: ManuscriptNode["type"];
  parentId: string;
};

export type ManuscriptRenamingState = {
  mode: "renaming";
  id: string;
  kind: ManuscriptNode["type"];
};

export type ManuscriptEditingState = ManuscriptCreatingState | ManuscriptRenamingState;

export type ManuscriptDragState = {
  sourceId: string;
  sourceType: ManuscriptNode["type"];
  targetParentId: string | null;
};

export type ManuscriptTreeState = {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  outline: ManuscriptOutline | null;
  expandedIds: Record<string, true>;
  selectedId: string | null;
  editing: ManuscriptEditingState | null;
  drag: ManuscriptDragState | null;
  nextEditingId: number;
};

export const initialManuscriptTreeState: ManuscriptTreeState = {
  status: "idle",
  error: null,
  outline: null,
  expandedIds: { root: true },
  selectedId: null,
  editing: null,
  drag: null,
  nextEditingId: 1,
};
