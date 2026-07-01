import type { ResourceNode } from "#shared/rpc/projects-rpc";

import type { ResourceTreeNode } from "../resource-tree";
import { buildVisibleResourceTree } from "./tree-cache";
import type { CreatingState, RenamingState, ResourceTreeDataState } from "./types";
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
  | { type: "shiftReloadQueue" };

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

export type FlatRenderItem =
  | { key: string; kind: "node"; node: ResourceTreeNode; depth: number }
  | {
      key: string;
      kind: "editing";
      editing:
        | {
            mode: "creating";
            kind: CreatingState["kind"];
            parentPath: string;
          }
        | {
            mode: "renaming";
            kind: RenamingState["kind"];
            path: string;
            currentName: string;
          };
      depth: number;
    };

export function buildFlatRenderItems(
  flatItems: Array<{ node: ResourceTreeNode; depth: number }>,
  creating: CreatingState | null,
  renaming: RenamingState | null,
): FlatRenderItem[] {
  const items: FlatRenderItem[] = flatItems.map(({ node, depth }) => ({
    key: node.path,
    kind: "node" as const,
    node,
    depth,
  }));

  // Handle renaming: replace the node at renaming.path with an inline edit row.
  if (renaming) {
    const renameIdx = items.findIndex(
      (item) => item.kind === "node" && item.node.path === renaming.path,
    );
    if (renameIdx >= 0) {
      const nodeItem = items[renameIdx] as { kind: "node"; node: ResourceTreeNode; depth: number };
      items.splice(renameIdx, 1, {
        key: `renaming-${renaming.path}`,
        kind: "editing",
        editing: {
          mode: "renaming",
          kind: renaming.kind,
          path: renaming.path,
          currentName: nodeItem.node.name,
        },
        depth: nodeItem.depth,
      });
    }
    // If renaming but node not found in flat items (e.g. not expanded), just return — cancel.
  }

  if (!creating) {
    return items;
  }

  const prefix = creating.parentPath === "" ? "" : `${creating.parentPath}/`;
  let insertAt = 0;
  let depth = 0;

  if (creating.kind === "folder") {
    if (creating.parentPath !== "") {
      const parentIdx = flatItems.findIndex((item) => item.node.path === creating.parentPath);
      insertAt = parentIdx >= 0 ? parentIdx + 1 : 0;
      depth = parentIdx >= 0 ? flatItems[parentIdx].depth + 1 : 0;
    }
  } else {
    let lastDirIdx = -1;
    for (let i = 0; i < flatItems.length; i++) {
      if (flatItems[i].node.type !== "folder") continue;
      const p = flatItems[i].node.path;
      const isDirectChild =
        creating.parentPath === ""
          ? !p.includes("/")
          : p.startsWith(prefix) && !p.slice(prefix.length).includes("/");
      if (isDirectChild) {
        lastDirIdx = i;
      }
    }
    if (lastDirIdx >= 0) {
      insertAt = lastDirIdx + 1;
      depth = flatItems[lastDirIdx].depth;
    } else if (creating.parentPath !== "") {
      const parentIdx = flatItems.findIndex((item) => item.node.path === creating.parentPath);
      insertAt = parentIdx >= 0 ? parentIdx + 1 : 0;
      depth = parentIdx >= 0 ? flatItems[parentIdx].depth + 1 : 0;
    }
  }

  items.splice(insertAt, 0, {
    key: `creating-${creating.id}`,
    kind: "editing",
    editing: {
      mode: "creating",
      kind: creating.kind,
      parentPath: creating.parentPath,
    },
    depth,
  });

  return items;
}
