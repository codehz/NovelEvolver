import type {
  ResourceTreeDelta,
  ResourceTreeNode,
  ResourceTreeSnapshot,
} from "#shared/rpc/worktree-tree-rpc";

import type { TreeResolvedDrop } from "../../../tree/tree-drag";
import { applyWorktreeTreeDelta } from "../../../worktree/worktree-tree-state";
import { findResourceParentId } from "../resource-tree";
import { isInvalidDropTarget } from "../resource-tree-placement-policy";
import type { ResourceTreeEditingState, ResourceTreeState } from "./types";
import { initialResourceTreeState } from "./types";

export type ResourceTreeAction =
  | { type: "loadStart" }
  | { type: "loadSuccess"; snapshot: ResourceTreeSnapshot }
  | { type: "loadError"; message: string }
  | { type: "applyDelta"; delta: ResourceTreeDelta; revision: number }
  | { type: "select"; id: string; nodeType: ResourceTreeNode["type"] }
  | { type: "toggleFolder"; id: string }
  | { type: "expandPath"; id: string }
  | { type: "expandPaths"; ids: string[] }
  | { type: "startEditing"; editing: ResourceTreeEditingState }
  | { type: "cancelEditing" }
  | { type: "dragStart"; sourceId: string; sourceType: ResourceTreeNode["type"] }
  | { type: "dragMove"; resolved: TreeResolvedDrop<string> | null }
  | { type: "dragEnd" };

function appendExpandedPath(expandedPaths: Record<string, true>, id: string): Record<string, true> {
  if (expandedPaths[id]) {
    return expandedPaths;
  }
  return {
    ...expandedPaths,
    [id]: true,
  };
}

function appendExpandedPaths(
  expandedPaths: Record<string, true>,
  ids: string[],
): Record<string, true> {
  let next = expandedPaths;
  for (const id of ids) {
    next = appendExpandedPath(next, id);
  }
  return next;
}

function filterExpandedPaths(
  snapshot: ResourceTreeSnapshot,
  expandedPaths: Record<string, true>,
): Record<string, true> {
  const next: Record<string, true> = {};
  for (const id of Object.keys(expandedPaths)) {
    if (snapshot.nodes[id]?.type === "folder") {
      next[id] = true;
    }
  }
  return next;
}

function collectSnapshotIds(snapshot: ResourceTreeSnapshot): string[] {
  const ids: string[] = [];
  const visit = (id: string): void => {
    const node = snapshot.nodes[id];
    if (node === undefined || node.type !== "folder") {
      return;
    }
    for (const childId of node.childIds) {
      ids.push(childId);
      if (snapshot.nodes[childId]?.type === "folder") {
        visit(childId);
      }
    }
  };
  visit(snapshot.rootId);
  return ids;
}

function reconcileVisualIds(
  state: ResourceTreeState,
  snapshot: ResourceTreeSnapshot,
): Pick<ResourceTreeState, "nodeVisualIds" | "nextVisualId"> {
  const nextNodeVisualIds: Record<string, string> = {};
  let nextVisualId = state.nextVisualId;
  for (const id of collectSnapshotIds(snapshot)) {
    const existing = state.nodeVisualIds[id];
    if (existing !== undefined) {
      nextNodeVisualIds[id] = existing;
      continue;
    }
    nextNodeVisualIds[id] = `resource-node-${nextVisualId}`;
    nextVisualId += 1;
  }
  return {
    nodeVisualIds: nextNodeVisualIds,
    nextVisualId,
  };
}

function nearestExistingFolderId(snapshot: ResourceTreeSnapshot, id: string): string {
  let current = findResourceParentId(snapshot, id);
  while (current !== null) {
    const node = snapshot.nodes[current];
    if (node?.type === "folder") {
      return current;
    }
    current = findResourceParentId(snapshot, current);
  }
  return snapshot.rootId;
}

function pruneSelection(
  selected: ResourceTreeState["selected"],
  snapshot: ResourceTreeSnapshot,
): ResourceTreeState["selected"] {
  if (selected === null) {
    return null;
  }
  const node = snapshot.nodes[selected.id];
  if (node !== undefined) {
    return {
      id: selected.id,
      type: node.type,
    };
  }
  return {
    id: nearestExistingFolderId(snapshot, selected.id),
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
    return snapshot.nodes[editing.parentId]?.type === "folder" ? editing : null;
  }
  const node = snapshot.nodes[editing.id];
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
    case "applyDelta":
      if (state.snapshot === null) {
        return state;
      }
      return applySnapshot(
        state,
        applyWorktreeTreeDelta(
          {
            revision: action.revision - 1,
            manuscript: { rootId: "root", nodes: {} },
            resources: state.snapshot,
          },
          {
            kind: "delta",
            fromRevision: action.revision - 1,
            toRevision: action.revision,
            resources: action.delta,
          },
        ).resources,
      );
    case "select":
      return {
        ...state,
        selected: {
          id: action.id,
          type: action.nodeType,
        },
      };
    case "toggleFolder": {
      const nextExpandedPaths = { ...state.expandedPaths };
      if (nextExpandedPaths[action.id]) {
        delete nextExpandedPaths[action.id];
      } else {
        nextExpandedPaths[action.id] = true;
      }
      return {
        ...state,
        expandedPaths: nextExpandedPaths,
      };
    }
    case "expandPath":
      return {
        ...state,
        expandedPaths: appendExpandedPath(state.expandedPaths, action.id),
      };
    case "expandPaths":
      return {
        ...state,
        expandedPaths: appendExpandedPaths(state.expandedPaths, action.ids),
      };
    case "startEditing":
      return {
        ...state,
        editing: action.editing,
        expandedPaths:
          action.editing.mode === "creating"
            ? appendExpandedPath(state.expandedPaths, action.editing.parentId)
            : state.expandedPaths,
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
            state.snapshot !== null &&
            !isInvalidDropTarget(
              state.snapshot,
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
