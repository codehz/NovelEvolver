import type {
  ManuscriptTreeDelta,
  ManuscriptTreeNode,
  ManuscriptTreeSnapshot,
} from "#shared/rpc/worktree/index";
import { applyManuscriptTreeDelta } from "#workbench/session/changes-feed/worktree-tree-state";
import type { TreeResolvedDrop } from "#workbench/tree/tree-drag";

import { findManuscriptParentId } from "../manuscript-tree";
import { isValidManuscriptMoveTarget } from "../manuscript-tree-placement-policy";
import type { ManuscriptDropTarget, ManuscriptTreeState } from "./types";
import { initialManuscriptTreeState } from "./types";

export type ManuscriptTreeAction =
  | { type: "loadStart" }
  | { type: "loadSuccess"; snapshot: ManuscriptTreeSnapshot }
  | { type: "loadError"; message: string }
  | { type: "applyDelta"; delta: ManuscriptTreeDelta; revision: number }
  | { type: "select"; id: string }
  | { type: "toggleFolder"; id: string }
  | { type: "expand"; id: string }
  | { type: "startCreating"; kind: ManuscriptTreeNode["type"]; parentId: string; index: number }
  | { type: "startRenaming"; id: string; kind: ManuscriptTreeNode["type"] }
  | { type: "cancelEditing" }
  | { type: "dragStart"; sourceId: string; sourceType: ManuscriptTreeNode["type"] }
  | { type: "dragMove"; resolved: TreeResolvedDrop<ManuscriptDropTarget> | null }
  | { type: "dragEnd" };

function pruneSelection(
  selectedId: string | null,
  snapshot: ManuscriptTreeSnapshot,
  nextSnapshot: ManuscriptTreeSnapshot,
): string | null {
  if (selectedId === null) {
    return null;
  }
  if (nextSnapshot.nodes[selectedId] !== undefined) {
    return selectedId;
  }
  return findManuscriptParentId(snapshot, selectedId);
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
        snapshot: action.snapshot,
      };
    case "loadError":
      return {
        ...initialManuscriptTreeState,
        status: "error",
        error: action.message,
      };
    case "applyDelta": {
      if (state.snapshot === null) {
        return state;
      }
      const nextSnapshot = applyManuscriptTreeDelta(state.snapshot, action.delta);
      return {
        ...state,
        status: "ready",
        error: null,
        snapshot: nextSnapshot,
        selectedId: pruneSelection(state.selectedId, state.snapshot, nextSnapshot),
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
      if (action.resolved === null) {
        return {
          ...state,
          drag: {
            ...state.drag,
            resolved: null,
          },
        };
      }
      if (action.resolved.target.mode === "transfer") {
        return {
          ...state,
          drag: {
            ...state.drag,
            resolved: action.resolved,
          },
        };
      }
      return {
        ...state,
        drag: {
          ...state.drag,
          resolved: isValidManuscriptMoveTarget(
            state.snapshot,
            state.drag.sourceId,
            state.drag.sourceType,
            action.resolved.target.move,
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
