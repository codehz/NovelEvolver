import type { ResourceNode } from "#shared/rpc/projects-rpc";

import type { ResourceTreeEditingState, ResourceTreeUiState } from "./types";
import { initialResourceTreeUiState } from "./types";

export type ResourceTreeUiAction =
  | { type: "select"; path: string; nodeType: ResourceNode["type"] }
  | { type: "startEditing"; editing: ResourceTreeEditingState }
  | { type: "cancelEditing" }
  | { type: "requestExpand"; path: string }
  | { type: "enqueueExpandPaths"; paths: string[] }
  | { type: "remapPaths"; from: string; to: string; nodeType: ResourceNode["type"] }
  | { type: "shiftExpandQueue" };

function remapPath(path: string, from: string, to: string, nodeType: ResourceNode["type"]): string {
  if (nodeType === "file") {
    return path === from ? to : path;
  }
  if (path === from) {
    return to;
  }
  if (path.startsWith(`${from}/`)) {
    return `${to}${path.slice(from.length)}`;
  }
  return path;
}

function remapEditingState(
  editing: ResourceTreeUiState["editing"],
  from: string,
  to: string,
  nodeType: ResourceNode["type"],
): ResourceTreeUiState["editing"] {
  if (editing === null) {
    return null;
  }
  if (editing.mode === "creating") {
    const parentPath = remapPath(editing.parentPath, from, to, nodeType);
    return parentPath === editing.parentPath ? editing : { ...editing, parentPath };
  }
  const path = remapPath(editing.path, from, to, nodeType);
  return path === editing.path ? editing : { ...editing, path };
}

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
    case "startEditing":
      return {
        ...state,
        editing: action.editing,
        expandPathQueue:
          action.editing.mode === "creating" && action.editing.parentPath !== ""
            ? appendExpandPath(state.expandPathQueue, action.editing.parentPath)
            : state.expandPathQueue,
      };
    case "cancelEditing":
      return {
        ...state,
        editing: null,
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
    case "remapPaths":
      return {
        ...state,
        selected:
          state.selected === null
            ? null
            : {
                ...state.selected,
                path: remapPath(state.selected.path, action.from, action.to, action.nodeType),
              },
        editing: remapEditingState(state.editing, action.from, action.to, action.nodeType),
        expandPathQueue: appendExpandPaths(
          [],
          state.expandPathQueue.map((path) =>
            remapPath(path, action.from, action.to, action.nodeType),
          ),
        ),
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
