import type { ManuscriptNode, ManuscriptOutline } from "#shared/rpc/projects-rpc";

import type { TreeResolvedDrop } from "../../tree/tree-drag";
import { findManuscriptParentId } from "../manuscript-tree";
import { isValidManuscriptMoveTarget } from "../manuscript-tree-placement-policy";
import type { ManuscriptMoveTarget, ManuscriptTreeState } from "./types";
import { initialManuscriptTreeState } from "./types";

export type ManuscriptTreeAction =
  | { type: "loadStart" }
  | { type: "loadSuccess"; outline: ManuscriptOutline }
  | { type: "loadError"; message: string }
  | { type: "setOutline"; outline: ManuscriptOutline }
  | { type: "select"; id: string }
  | { type: "toggleFolder"; id: string }
  | { type: "expand"; id: string }
  | { type: "startCreating"; kind: ManuscriptNode["type"]; parentId: string; index: number }
  | { type: "startRenaming"; id: string; kind: ManuscriptNode["type"] }
  | { type: "cancelEditing" }
  | { type: "dragStart"; sourceId: string; sourceType: ManuscriptNode["type"] }
  | { type: "dragMove"; resolved: TreeResolvedDrop<ManuscriptMoveTarget> | null }
  | { type: "dragEnd" };

function pruneSelection(
  selectedId: string | null,
  outline: ManuscriptOutline,
  nextOutline: ManuscriptOutline,
): string | null {
  if (selectedId === null) {
    return null;
  }
  if (nextOutline.nodes[selectedId] !== undefined) {
    return selectedId;
  }
  return findManuscriptParentId(outline, selectedId);
}

export function manuscriptTreeReducer(
  state: ManuscriptTreeState,
  action: ManuscriptTreeAction,
): ManuscriptTreeState {
  switch (action.type) {
    case "loadStart":
      return {
        ...initialManuscriptTreeState,
        status: "loading",
      };
    case "loadSuccess":
      return {
        ...state,
        status: "ready",
        error: null,
        outline: action.outline,
      };
    case "loadError":
      return {
        ...initialManuscriptTreeState,
        status: "error",
        error: action.message,
      };
    case "setOutline": {
      const previousOutline = state.outline ?? action.outline;
      return {
        ...state,
        status: "ready",
        error: null,
        outline: action.outline,
        selectedId: pruneSelection(state.selectedId, previousOutline, action.outline),
      };
    }
    case "select":
      return {
        ...state,
        selectedId: action.id,
      };
    case "toggleFolder": {
      const expandedIds = { ...state.expandedIds };
      if (expandedIds[action.id]) {
        delete expandedIds[action.id];
      } else {
        expandedIds[action.id] = true;
      }
      return {
        ...state,
        expandedIds,
      };
    }
    case "expand":
      return {
        ...state,
        expandedIds: { ...state.expandedIds, [action.id]: true },
      };
    case "startCreating":
      return {
        ...state,
        editing: {
          mode: "creating",
          id: state.nextEditingId,
          kind: action.kind,
          parentId: action.parentId,
          index: action.index,
        },
        expandedIds: { ...state.expandedIds, [action.parentId]: true },
        nextEditingId: state.nextEditingId + 1,
      };
    case "startRenaming":
      return {
        ...state,
        editing: { mode: "renaming", id: action.id, kind: action.kind },
      };
    case "cancelEditing":
      return {
        ...state,
        editing: null,
      };
    case "dragStart":
      return {
        ...state,
        drag: {
          sourceId: action.sourceId,
          sourceType: action.sourceType,
          resolved: null,
        },
      };
    case "dragMove":
      if (state.drag === null) {
        return state;
      }
      return {
        ...state,
        drag: {
          ...state.drag,
          resolved:
            action.resolved !== null &&
            isValidManuscriptMoveTarget(
              state.outline,
              state.drag.sourceId,
              state.drag.sourceType,
              action.resolved.target,
            )
              ? action.resolved
              : null,
        },
      };
    case "dragEnd":
      return {
        ...state,
        drag: null,
      };
    default:
      return state;
  }
}
