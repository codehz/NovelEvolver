import type {
  ManuscriptTreeNode,
  ManuscriptTreeSnapshot,
  ResourceTreeNode,
  ResourceTreeSnapshot,
} from "#shared/rpc/worktree-tree-rpc";

import { cloneOutline } from "../manuscript/outline";
import type { ResourceSnapshotState } from "../resource-snapshot-state";
import type { ManuscriptSnapshotState } from "../snapshot-state";

export function cloneManuscriptTreeNode(node: ManuscriptTreeNode): ManuscriptTreeNode {
  return {
    ...node,
    childIds: [...node.childIds],
  };
}

export function cloneResourceTreeNode(node: ResourceTreeNode): ResourceTreeNode {
  return {
    ...node,
    childIds: [...node.childIds],
  };
}

export function cloneManuscriptTreeSnapshot(
  snapshot: ManuscriptTreeSnapshot,
): ManuscriptTreeSnapshot {
  return {
    rootId: snapshot.rootId,
    nodes: Object.fromEntries(
      Object.entries(snapshot.nodes).map(([id, node]) => [id, cloneManuscriptTreeNode(node)]),
    ),
  };
}

export function cloneResourceTreeSnapshot(snapshot: ResourceTreeSnapshot): ResourceTreeSnapshot {
  return {
    rootId: snapshot.rootId,
    nodes: Object.fromEntries(
      Object.entries(snapshot.nodes).map(([id, node]) => [id, cloneResourceTreeNode(node)]),
    ),
  };
}

export function cloneManuscriptSnapshotState(
  state: ManuscriptSnapshotState,
): ManuscriptSnapshotState {
  return {
    outline: cloneOutline(state.outline),
    entries: new Map(
      [...state.entries.entries()].map(([id, entry]) => [
        id,
        {
          ...entry,
          childIds: [...entry.childIds],
        },
      ]),
    ),
  };
}

export function cloneResourceSnapshotState(state: ResourceSnapshotState): ResourceSnapshotState {
  return {
    entries: new Map(
      [...state.entries.entries()].map(([id, entry]) => [
        id,
        {
          ...entry,
        },
      ]),
    ),
  };
}
