import type { ResourceNode } from "@shared/rpc/projects-rpc";

import {
  findNode,
  nodesToTreeChildren,
  setNodeAtPath,
  type ResourceTreeNode,
} from "../resource-tree";
import type { CreatingState, ResourceTreeDataState } from "./types";
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
        roots: nodesToTreeChildren("", action.entries),
        status: "ready",
        error: null,
        reloadPaths: [],
      };
    case "reloadRootSuccess":
      return {
        ...state,
        roots: mergeRootsPreservingExpanded(state.roots, action.entries),
        status: "ready",
        error: null,
      };
    case "initError":
      return {
        roots: [],
        status: "error",
        error: action.message,
        reloadPaths: [],
      };
    case "setNodeLoading":
      return {
        ...state,
        roots: setNodeAtPath(state.roots, action.path, (node) => ({
          ...node,
          loading: action.loading,
        })),
      };
    case "setNodeChildren":
      return {
        ...state,
        roots: setNodeAtPath(state.roots, action.path, (node) => ({
          ...node,
          loading: false,
          children: nodesToTreeChildren(action.path, action.entries),
        })),
      };
    case "setNodeExpanded":
      return {
        ...state,
        roots: setNodeAtPath(state.roots, action.path, (node) => ({
          ...node,
          expanded: action.expanded,
        })),
      };
    case "toggleFolder": {
      const node = findNode(state.roots, action.path);
      if (!node || node.type !== "folder") {
        return state;
      }
      return {
        ...state,
        roots: setNodeAtPath(state.roots, action.path, (n) => ({
          ...n,
          expanded: !n.expanded,
        })),
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
      const expanded = findNode(state.roots, path)?.expanded ?? false;
      const nextRoots = setNodeAtPath(state.roots, path, (node) => ({
        ...node,
        children: null,
        loading: false,
        expanded,
      }));
      const queue = state.reloadPaths.includes(path)
        ? state.reloadPaths
        : [...state.reloadPaths, path];
      return {
        ...state,
        roots: nextRoots,
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

export type FlatRenderItem =
  | { key: string; kind: "node"; node: ResourceTreeNode; depth: number }
  | { key: string; kind: "creating"; creating: CreatingState; depth: number };

export function buildFlatRenderItems(
  flatItems: Array<{ node: ResourceTreeNode; depth: number }>,
  creating: CreatingState | null,
): FlatRenderItem[] {
  const items: FlatRenderItem[] = flatItems.map(({ node, depth }) => ({
    key: node.path,
    kind: "node" as const,
    node,
    depth,
  }));

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
    kind: "creating",
    creating,
    depth,
  });

  return items;
}

function mergeRootsPreservingExpanded(
  previous: ResourceTreeNode[],
  entries: ResourceNode[],
): ResourceTreeNode[] {
  const byPath = new Map<string, ResourceTreeNode>();
  const indexPrevious = (nodes: ResourceTreeNode[]) => {
    for (const node of nodes) {
      byPath.set(node.path, node);
      if (node.children) {
        indexPrevious(node.children);
      }
    }
  };
  indexPrevious(previous);
  const fresh = nodesToTreeChildren("", entries);
  return fresh.map((node) => {
    const prev = byPath.get(node.path);
    if (!prev || node.type !== "folder" || prev.type !== "folder") {
      return node;
    }
    return {
      ...node,
      expanded: prev.expanded,
      loading: prev.loading,
      children: prev.children,
    };
  });
}
