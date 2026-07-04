import { remapResourcePath, resourceParentPath } from "#shared/resource-library-path";
import type { ResourceNode } from "#shared/rpc/projects-rpc";

import type { TreeResolvedDrop } from "../../tree/tree-drag";
import type { ResourceTreeEditingState, ResourceTreeUiState } from "./types";
import { initialResourceTreeUiState } from "./types";

export type ResourceTreeUiAction =
  | { type: "select"; path: string; nodeType: ResourceNode["type"] }
  | { type: "startEditing"; editing: ResourceTreeEditingState }
  | { type: "cancelEditing" }
  | { type: "requestExpand"; path: string }
  | { type: "enqueueExpandPaths"; paths: string[] }
  | { type: "remapPaths"; from: string; to: string; nodeType: ResourceNode["type"] }
  | { type: "shiftExpandQueue" }
  | { type: "dragStart"; sourcePath: string; sourceType: ResourceNode["type"] }
  | { type: "dragMove"; resolved: TreeResolvedDrop<string> | null }
  | { type: "dragEnd" };

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
    const parentPath = remapResourcePath(editing.parentPath, from, to, nodeType);
    return parentPath === editing.parentPath ? editing : { ...editing, parentPath };
  }
  const path = remapResourcePath(editing.path, from, to, nodeType);
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
                path: remapResourcePath(
                  state.selected.path,
                  action.from,
                  action.to,
                  action.nodeType,
                ),
              },
        editing: remapEditingState(state.editing, action.from, action.to, action.nodeType),
        expandPathQueue: appendExpandPaths(
          [],
          state.expandPathQueue.map((path) =>
            remapResourcePath(path, action.from, action.to, action.nodeType),
          ),
        ),
      };
    case "shiftExpandQueue":
      return {
        ...state,
        expandPathQueue: state.expandPathQueue.slice(1),
      };
    case "dragStart":
      return {
        ...state,
        drag: { sourcePath: action.sourcePath, sourceType: action.sourceType, resolved: null },
      };
    case "dragMove":
      if (state.drag === null) {
        return state;
      }
      return {
        ...state,
        drag: { ...state.drag, resolved: action.resolved },
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

export function parentPathForCreating(selected: ResourceTreeUiState["selected"]): string {
  if (selected === null) {
    return "";
  }
  if (selected.type === "folder") {
    return selected.path;
  }
  return resourceParentPath(selected.path);
}

export { initialResourceTreeUiState };
