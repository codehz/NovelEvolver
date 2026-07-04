import { remapResourcePath, resourceParentPath } from "#shared/resource-library-path";
import type { ResourceNode, ResourceTreeSnapshot } from "#shared/rpc/projects-rpc";

import type { TreeResolvedDrop } from "../../tree/tree-drag";
import { findSubtreeEndIndex } from "../../tree/tree-row-helpers";
import { isInvalidDropTarget } from "../drag-hit-test";
import type { ResourceTreeEditingState, ResourceTreeState } from "./types";
import { initialResourceTreeState } from "./types";

export type ResourceTreeAction =
  | { type: "loadStart" }
  | { type: "loadSuccess"; snapshot: ResourceTreeSnapshot }
  | { type: "loadError"; message: string }
  | { type: "setSnapshot"; snapshot: ResourceTreeSnapshot }
  | { type: "select"; path: string; nodeType: ResourceNode["type"] }
  | { type: "toggleFolder"; path: string }
  | { type: "expandPath"; path: string }
  | { type: "expandPaths"; paths: string[] }
  | { type: "startEditing"; editing: ResourceTreeEditingState }
  | { type: "cancelEditing" }
  | { type: "remapPaths"; from: string; to: string; nodeType: ResourceNode["type"] }
  | { type: "dragStart"; sourcePath: string; sourceType: ResourceNode["type"] }
  | { type: "dragMove"; resolved: TreeResolvedDrop<string> | null }
  | { type: "dragEnd" };

function appendExpandedPath(
  expandedPaths: Record<string, true>,
  path: string,
): Record<string, true> {
  if (path === "" || expandedPaths[path]) {
    return expandedPaths;
  }
  return {
    ...expandedPaths,
    [path]: true,
  };
}

function appendExpandedPaths(
  expandedPaths: Record<string, true>,
  paths: string[],
): Record<string, true> {
  let next = expandedPaths;
  for (const path of paths) {
    next = appendExpandedPath(next, path);
  }
  return next;
}

function filterExpandedPaths(
  snapshot: ResourceTreeSnapshot,
  expandedPaths: Record<string, true>,
): Record<string, true> {
  const next: Record<string, true> = {};
  for (const path of Object.keys(expandedPaths)) {
    if (snapshot.nodes[path]?.type === "folder") {
      next[path] = true;
    }
  }
  return next;
}

function remapExpandedPaths(
  expandedPaths: Record<string, true>,
  from: string,
  to: string,
  nodeType: ResourceNode["type"],
): Record<string, true> {
  const next: Record<string, true> = {};
  for (const path of Object.keys(expandedPaths)) {
    next[remapResourcePath(path, from, to, nodeType)] = true;
  }
  return next;
}

function remapEditingState(
  editing: ResourceTreeEditingState | null,
  from: string,
  to: string,
  nodeType: ResourceNode["type"],
): ResourceTreeEditingState | null {
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

function remapNodeVisualIds(
  nodeVisualIds: Record<string, string>,
  from: string,
  to: string,
  nodeType: ResourceNode["type"],
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [path, visualId] of Object.entries(nodeVisualIds)) {
    next[remapResourcePath(path, from, to, nodeType)] = visualId;
  }
  return next;
}

function remapSelection(
  selected: ResourceTreeState["selected"],
  from: string,
  to: string,
  nodeType: ResourceNode["type"],
): ResourceTreeState["selected"] {
  if (selected === null) {
    return null;
  }
  return {
    ...selected,
    path: remapResourcePath(selected.path, from, to, nodeType),
  };
}

function collectSnapshotPaths(snapshot: ResourceTreeSnapshot): string[] {
  const paths: string[] = [];
  const visit = (path: string): void => {
    const node = snapshot.nodes[path];
    if (node === undefined || node.type !== "folder") {
      return;
    }
    for (const childPath of node.children) {
      paths.push(childPath);
      if (snapshot.nodes[childPath]?.type === "folder") {
        visit(childPath);
      }
    }
  };
  visit(snapshot.rootPath);
  return paths;
}

function reconcileVisualIds(
  state: ResourceTreeState,
  snapshot: ResourceTreeSnapshot,
): Pick<ResourceTreeState, "nodeVisualIds" | "nextVisualId"> {
  const nextNodeVisualIds: Record<string, string> = {};
  let nextVisualId = state.nextVisualId;
  for (const path of collectSnapshotPaths(snapshot)) {
    const existing = state.nodeVisualIds[path];
    if (existing !== undefined) {
      nextNodeVisualIds[path] = existing;
      continue;
    }
    nextNodeVisualIds[path] = `resource-node-${nextVisualId}`;
    nextVisualId += 1;
  }
  return {
    nodeVisualIds: nextNodeVisualIds,
    nextVisualId,
  };
}

function nearestExistingFolderPath(snapshot: ResourceTreeSnapshot, path: string): string {
  let current = path;
  while (true) {
    const node = snapshot.nodes[current];
    if (node?.type === "folder") {
      return current;
    }
    if (current === "") {
      return "";
    }
    current = resourceParentPath(current);
  }
}

function pruneSelection(
  selected: ResourceTreeState["selected"],
  snapshot: ResourceTreeSnapshot,
): ResourceTreeState["selected"] {
  if (selected === null) {
    return null;
  }
  const node = snapshot.nodes[selected.path];
  if (node !== undefined) {
    return {
      path: selected.path,
      type: node.type,
    };
  }
  return {
    path: nearestExistingFolderPath(snapshot, selected.path),
    type: "folder",
  };
}

function pruneEditing(
  editing: ResourceTreeEditingState | null,
  snapshot: ResourceTreeSnapshot,
): ResourceTreeEditingState | null {
  if (editing === null) {
    return null;
  }
  if (editing.mode === "creating") {
    return snapshot.nodes[editing.parentPath]?.type === "folder" ? editing : null;
  }
  const node = snapshot.nodes[editing.path];
  return node?.type === editing.kind ? editing : null;
}

function applySnapshot(
  state: ResourceTreeState,
  snapshot: ResourceTreeSnapshot,
): ResourceTreeState {
  return {
    ...state,
    status: "ready",
    error: null,
    snapshot,
    expandedPaths: filterExpandedPaths(snapshot, state.expandedPaths),
    selected: pruneSelection(state.selected, snapshot),
    editing: pruneEditing(state.editing, snapshot),
    ...reconcileVisualIds(state, snapshot),
  };
}

export function resourceTreeReducer(
  state: ResourceTreeState,
  action: ResourceTreeAction,
): ResourceTreeState {
  switch (action.type) {
    case "loadStart":
      return {
        ...initialResourceTreeState,
        status: "loading",
      };
    case "loadSuccess":
      return applySnapshot(
        {
          ...state,
          status: "ready",
          error: null,
        },
        action.snapshot,
      );
    case "loadError":
      return {
        ...initialResourceTreeState,
        status: "error",
        error: action.message,
      };
    case "setSnapshot":
      return applySnapshot(state, action.snapshot);
    case "select":
      return {
        ...state,
        selected: {
          path: action.path,
          type: action.nodeType,
        },
      };
    case "toggleFolder": {
      const nextExpandedPaths = { ...state.expandedPaths };
      if (nextExpandedPaths[action.path]) {
        delete nextExpandedPaths[action.path];
      } else {
        nextExpandedPaths[action.path] = true;
      }
      return {
        ...state,
        expandedPaths: nextExpandedPaths,
      };
    }
    case "expandPath":
      return {
        ...state,
        expandedPaths: appendExpandedPath(state.expandedPaths, action.path),
      };
    case "expandPaths":
      return {
        ...state,
        expandedPaths: appendExpandedPaths(state.expandedPaths, action.paths),
      };
    case "startEditing":
      return {
        ...state,
        editing: action.editing,
        expandedPaths:
          action.editing.mode === "creating"
            ? appendExpandedPath(state.expandedPaths, action.editing.parentPath)
            : state.expandedPaths,
      };
    case "cancelEditing":
      return {
        ...state,
        editing: null,
      };
    case "remapPaths":
      return {
        ...state,
        expandedPaths: remapExpandedPaths(
          state.expandedPaths,
          action.from,
          action.to,
          action.nodeType,
        ),
        selected: remapSelection(state.selected, action.from, action.to, action.nodeType),
        editing: remapEditingState(state.editing, action.from, action.to, action.nodeType),
        nodeVisualIds: remapNodeVisualIds(
          state.nodeVisualIds,
          action.from,
          action.to,
          action.nodeType,
        ),
      };
    case "dragStart":
      return {
        ...state,
        drag: {
          sourcePath: action.sourcePath,
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
            state.snapshot !== null &&
            !isInvalidDropTarget(
              state.snapshot,
              state.drag.sourcePath,
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

type FlatTreeNode = {
  visualId: string;
  path: string;
  name: string;
  type: ResourceNode["type"];
  depth: number;
  expanded: boolean;
};

function flattenVisibleNodes(
  snapshot: ResourceTreeSnapshot,
  expandedPaths: Record<string, true>,
  nodeVisualIds: Record<string, string>,
): FlatTreeNode[] {
  const result: FlatTreeNode[] = [];

  const visit = (parentPath: string, depth: number): void => {
    const parent = snapshot.nodes[parentPath];
    if (parent?.type !== "folder") {
      return;
    }
    for (const childPath of parent.children) {
      const node = snapshot.nodes[childPath];
      if (node === undefined) {
        continue;
      }
      const expanded = node.type === "folder" && expandedPaths[node.path] === true;
      result.push({
        visualId: nodeVisualIds[node.path] ?? node.path,
        path: node.path,
        name: node.name,
        type: node.type,
        depth,
        expanded,
      });
      if (node.type === "folder" && expanded) {
        visit(node.path, depth + 1);
      }
    }
  };

  visit(snapshot.rootPath, 0);
  return result;
}

export type FlatRenderItem = {
  key: string;
  visualId: string | null;
  depth: number;
  type: ResourceNode["type"];
  path: string | null;
  name: string;
  expanded: boolean;
  loading: boolean;
  editing: ResourceTreeEditingState | null;
};

export function buildFlatRenderItems(state: ResourceTreeState): FlatRenderItem[] {
  if (state.snapshot === null) {
    return [];
  }

  const flatItems = flattenVisibleNodes(state.snapshot, state.expandedPaths, state.nodeVisualIds);
  const items: FlatRenderItem[] = flatItems.map((item) => ({
    key: item.visualId,
    visualId: item.visualId,
    depth: item.depth,
    type: item.type,
    path: item.path,
    name: item.name,
    expanded: item.expanded,
    loading: false,
    editing: null,
  }));

  if (state.editing?.mode === "renaming") {
    const renaming = state.editing;
    const renameIndex = items.findIndex((item) => item.path === renaming.path);
    if (renameIndex >= 0) {
      items[renameIndex] = {
        ...items[renameIndex],
        editing: renaming,
      };
    }
  }

  const editing = state.editing;
  if (editing?.mode !== "creating") {
    return items;
  }

  const prefix = editing.parentPath === "" ? "" : `${editing.parentPath}/`;
  let insertAt = 0;
  let depth = 0;

  if (editing.kind === "folder") {
    if (editing.parentPath !== "") {
      const parentIndex = flatItems.findIndex((item) => item.path === editing.parentPath);
      insertAt = parentIndex >= 0 ? parentIndex + 1 : 0;
      depth = parentIndex >= 0 ? flatItems[parentIndex]!.depth + 1 : 0;
    }
  } else {
    let lastFolderIndex = -1;
    for (let index = 0; index < flatItems.length; index += 1) {
      if (flatItems[index]!.type !== "folder") {
        continue;
      }
      const path = flatItems[index]!.path;
      const isDirectChild =
        editing.parentPath === ""
          ? !path.includes("/")
          : path.startsWith(prefix) && !path.slice(prefix.length).includes("/");
      if (isDirectChild) {
        lastFolderIndex = index;
      }
    }
    if (lastFolderIndex >= 0) {
      insertAt = findSubtreeEndIndex(flatItems, lastFolderIndex) + 1;
      depth = flatItems[lastFolderIndex]!.depth;
    } else if (editing.parentPath !== "") {
      const parentIndex = flatItems.findIndex((item) => item.path === editing.parentPath);
      insertAt = parentIndex >= 0 ? parentIndex + 1 : 0;
      depth = parentIndex >= 0 ? flatItems[parentIndex]!.depth + 1 : 0;
    }
  }

  items.splice(insertAt, 0, {
    key: `creating-${editing.id}`,
    visualId: null,
    depth,
    type: editing.kind,
    path: null,
    name: "",
    expanded: false,
    loading: false,
    editing,
  });

  return items;
}
