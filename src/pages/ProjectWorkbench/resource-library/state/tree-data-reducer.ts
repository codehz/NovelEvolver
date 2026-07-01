import type { ResourceNode } from "#shared/rpc/projects-rpc";

import type { ResourceTreeNode } from "../resource-tree";
import { buildVisibleResourceTree } from "./tree-cache";
import type { ResourceTreeDataState, ResourceTreeEditingState } from "./types";
import { initialResourceTreeDataState } from "./types";

export type ResourceTreeDataAction =
  | { type: "initStart" }
  | { type: "initSuccess"; entries: ResourceNode[] }
  | { type: "reloadRootSuccess"; entries: ResourceNode[] }
  | { type: "initError"; message: string }
  | { type: "setNodeLoading"; path: string; loading: boolean }
  | { type: "setNodeChildren"; path: string; entries: ResourceNode[] }
  | { type: "setNodeExpanded"; path: string; expanded: boolean }
  | { type: "toggleFolder"; path: string }
  | { type: "invalidatePath"; path: string }
  | { type: "queueReloadPath"; path: string }
  | { type: "remapPaths"; from: string; to: string; nodeType: ResourceNode["type"] }
  | { type: "shiftReloadQueue" };

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

function remapExpandedPaths(
  expandedPaths: ResourceTreeDataState["expandedPaths"],
  from: string,
  to: string,
  nodeType: ResourceNode["type"],
): ResourceTreeDataState["expandedPaths"] {
  const next: ResourceTreeDataState["expandedPaths"] = {};
  for (const path of Object.keys(expandedPaths)) {
    next[remapPath(path, from, to, nodeType)] = true;
  }
  return next;
}

function remapListings(
  listings: ResourceTreeDataState["listings"],
  from: string,
  to: string,
  nodeType: ResourceNode["type"],
): ResourceTreeDataState["listings"] {
  const next: ResourceTreeDataState["listings"] = {};
  for (const [path, listing] of Object.entries(listings)) {
    next[remapPath(path, from, to, nodeType)] = listing;
  }
  return next;
}

function appendReloadPath(queue: string[], path: string): string[] {
  return queue.includes(path) ? queue : [...queue, path];
}

function remapReloadPaths(
  reloadPaths: string[],
  from: string,
  to: string,
  nodeType: ResourceNode["type"],
): string[] {
  const next: string[] = [];
  for (const path of reloadPaths) {
    const mapped = remapPath(path, from, to, nodeType);
    if (!next.includes(mapped)) {
      next.push(mapped);
    }
  }
  return next;
}

function dropListingSubtree(
  listings: ResourceTreeDataState["listings"],
  path: string,
): ResourceTreeDataState["listings"] {
  const next = { ...listings };
  for (const key of Object.keys(next)) {
    if (key === path || (path !== "" && key.startsWith(`${path}/`))) {
      delete next[key];
    }
  }
  return next;
}

function setListingLoading(
  listings: ResourceTreeDataState["listings"],
  path: string,
  loading: boolean,
): ResourceTreeDataState["listings"] {
  if (!loading) {
    const current = listings[path];
    if (current?.status === "loading") {
      return { ...listings, [path]: { status: "idle" } };
    }
    return listings;
  }
  return { ...listings, [path]: { status: "loading" } };
}

export function resourceTreeDataReducer(
  state: ResourceTreeDataState,
  action: ResourceTreeDataAction,
): ResourceTreeDataState {
  switch (action.type) {
    case "initStart":
      return {
        ...initialResourceTreeDataState,
        status: "loading",
      };
    case "initSuccess":
      return {
        status: "ready",
        error: null,
        expandedPaths: {},
        listings: { "": { status: "ready", entries: action.entries } },
        reloadPaths: [],
      };
    case "reloadRootSuccess":
      return {
        ...state,
        status: "ready",
        error: null,
        listings: {
          ...state.listings,
          "": { status: "ready", entries: action.entries },
        },
      };
    case "initError":
      return {
        ...initialResourceTreeDataState,
        status: "error",
        error: action.message,
      };
    case "setNodeLoading":
      return {
        ...state,
        listings: setListingLoading(state.listings, action.path, action.loading),
      };
    case "setNodeChildren":
      return {
        ...state,
        listings: {
          ...state.listings,
          [action.path]: { status: "ready", entries: action.entries },
        },
      };
    case "setNodeExpanded": {
      const nextExpanded = { ...state.expandedPaths };
      if (action.expanded) {
        nextExpanded[action.path] = true;
      } else {
        delete nextExpanded[action.path];
      }
      return {
        ...state,
        expandedPaths: nextExpanded,
      };
    }
    case "toggleFolder": {
      const nextExpanded = { ...state.expandedPaths };
      if (action.path in nextExpanded) {
        delete nextExpanded[action.path];
      } else {
        nextExpanded[action.path] = true;
      }
      return {
        ...state,
        expandedPaths: nextExpanded,
      };
    }
    case "invalidatePath": {
      const path = action.path;
      if (path === "") {
        return {
          ...state,
          reloadPaths: state.reloadPaths.includes("")
            ? state.reloadPaths
            : [...state.reloadPaths, ""],
        };
      }
      const queue = state.reloadPaths.includes(path)
        ? state.reloadPaths
        : [...state.reloadPaths, path];
      return {
        ...state,
        listings: dropListingSubtree(state.listings, path),
        reloadPaths: queue,
      };
    }
    case "queueReloadPath":
      return {
        ...state,
        reloadPaths: appendReloadPath(state.reloadPaths, action.path),
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
        listings: remapListings(state.listings, action.from, action.to, action.nodeType),
        reloadPaths: remapReloadPaths(state.reloadPaths, action.from, action.to, action.nodeType),
      };
    case "shiftReloadQueue":
      return {
        ...state,
        reloadPaths: state.reloadPaths.slice(1),
      };
    default:
      return state;
  }
}

export function flattenResourceTree(
  nodes: ResourceTreeNode[],
  depth: number = 0,
): Array<{ node: ResourceTreeNode; depth: number }> {
  const result: Array<{ node: ResourceTreeNode; depth: number }> = [];
  for (const node of nodes) {
    result.push({ node, depth });
    if (node.type === "folder" && node.expanded && node.children && node.children.length > 0) {
      result.push(...flattenResourceTree(node.children, depth + 1));
    }
  }
  return result;
}

export function flattenVisibleResourceTree(
  state: ResourceTreeDataState,
): Array<{ node: ResourceTreeNode; depth: number }> {
  return flattenResourceTree(buildVisibleResourceTree(state));
}

export type FlatRenderItem = {
  key: string;
  depth: number;
  type: ResourceNode["type"];
  path: string | null;
  name: string;
  expanded: boolean;
  loading: boolean;
  editing: ResourceTreeEditingState | null;
};

export function buildFlatRenderItems(
  flatItems: Array<{ node: ResourceTreeNode; depth: number }>,
  editing: ResourceTreeEditingState | null,
): FlatRenderItem[] {
  const items: FlatRenderItem[] = flatItems.map(({ node, depth }) => ({
    key: node.path,
    depth,
    type: node.type,
    path: node.path,
    name: node.name,
    expanded: node.expanded,
    loading: node.loading,
    editing: null,
  }));

  if (editing?.mode === "renaming") {
    const renameIdx = items.findIndex((item) => item.path === editing.path);
    if (renameIdx >= 0) {
      items[renameIdx] = {
        ...items[renameIdx],
        editing,
      };
    }
  }

  if (editing?.mode !== "creating") {
    return items;
  }

  const prefix = editing.parentPath === "" ? "" : `${editing.parentPath}/`;
  let insertAt = 0;
  let depth = 0;

  if (editing.kind === "folder") {
    if (editing.parentPath !== "") {
      const parentIdx = flatItems.findIndex((item) => item.node.path === editing.parentPath);
      insertAt = parentIdx >= 0 ? parentIdx + 1 : 0;
      depth = parentIdx >= 0 ? flatItems[parentIdx].depth + 1 : 0;
    }
  } else {
    let lastDirIdx = -1;
    for (let i = 0; i < flatItems.length; i++) {
      if (flatItems[i].node.type !== "folder") continue;
      const p = flatItems[i].node.path;
      const isDirectChild =
        editing.parentPath === ""
          ? !p.includes("/")
          : p.startsWith(prefix) && !p.slice(prefix.length).includes("/");
      if (isDirectChild) {
        lastDirIdx = i;
      }
    }
    if (lastDirIdx >= 0) {
      insertAt = lastDirIdx + 1;
      depth = flatItems[lastDirIdx].depth;
    } else if (editing.parentPath !== "") {
      const parentIdx = flatItems.findIndex((item) => item.node.path === editing.parentPath);
      insertAt = parentIdx >= 0 ? parentIdx + 1 : 0;
      depth = parentIdx >= 0 ? flatItems[parentIdx].depth + 1 : 0;
    }
  }

  items.splice(insertAt, 0, {
    key: `creating-${editing.id}`,
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
