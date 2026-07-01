import type { ResourceNode } from "@shared/rpc/projects-rpc";

import type { CreatingState, ResourceTreeUiState } from "./types";
import { initialResourceTreeUiState } from "./types";

export type ResourceTreeUiAction =
  | { type: "select"; path: string; nodeType: ResourceNode["type"] }
  | { type: "startCreating"; creating: CreatingState }
  | { type: "cancelCreating" }
  | { type: "requestExpand"; path: string }
  | { type: "enqueueExpandPaths"; paths: string[] }
  | { type: "shiftExpandQueue" };

function appendExpandPath(queue: string[], path: string): string[] {
  if (path === "" || queue.includes(path)) {
    return queue;
  }
  return [...queue, path];
}

function appendExpandPaths(queue: string[], paths: string[]): string[] {
  let next = queue;
  for (const path of paths) {
    next = appendExpandPath(next, path);
  }
  return next;
}

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
        expandPathQueue:
          action.creating.parentPath !== ""
            ? appendExpandPath(state.expandPathQueue, action.creating.parentPath)
            : state.expandPathQueue,
      };
    case "cancelCreating":
      return {
        ...state,
        creating: null,
      };
    case "requestExpand":
      return {
        ...state,
        expandPathQueue: appendExpandPath(state.expandPathQueue, action.path),
      };
    case "enqueueExpandPaths":
      return {
        ...state,
        expandPathQueue: appendExpandPaths(state.expandPathQueue, action.paths),
      };
    case "shiftExpandQueue":
      return {
        ...state,
        expandPathQueue: state.expandPathQueue.slice(1),
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
