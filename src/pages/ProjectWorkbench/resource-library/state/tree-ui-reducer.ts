import type { ResourceNode } from "@shared/rpc/projects-rpc";

import type { CreatingState, ResourceTreeUiState } from "./types";
import { initialResourceTreeUiState } from "./types";

export type ResourceTreeUiAction =
  | { type: "select"; path: string; nodeType: ResourceNode["type"] }
  | { type: "startCreating"; creating: CreatingState }
  | { type: "cancelCreating" }
  | { type: "requestExpand"; path: string }
  | { type: "clearExpandRequest" };

export function resourceTreeUiReducer(
  state: ResourceTreeUiState,
  action: ResourceTreeUiAction,
): ResourceTreeUiState {
  switch (action.type) {
    case "select":
      return {
        ...state,
        selected: { path: action.path, type: action.nodeType },
      };
    case "startCreating":
      return {
        ...state,
        creating: action.creating,
        expandRequest:
          action.creating.parentPath !== "" ? action.creating.parentPath : state.expandRequest,
      };
    case "cancelCreating":
      return {
        ...state,
        creating: null,
      };
    case "requestExpand":
      return {
        ...state,
        expandRequest: action.path,
      };
    case "clearExpandRequest":
      return {
        ...state,
        expandRequest: null,
      };
    default:
      return state;
  }
}

export function parentPathForCreating(selected: ResourceTreeUiState["selected"]): string {
  if (selected === null) {
    return "";
  }
  if (selected.type === "folder") {
    return selected.path;
  }
  const lastSlash = selected.path.lastIndexOf("/");
  return lastSlash >= 0 ? selected.path.slice(0, lastSlash) : "";
}

export { initialResourceTreeUiState };
