import type { TreeChildrenPatch } from "#shared/rpc/worktree-tree-rpc";

export type TreeSnapshotLike<TNode extends { childIds: string[] }> = {
  rootId: string;
  nodes: Record<string, TNode>;
};

export type TreeDeltaLike<TNode> = {
  putNodes: Record<string, TNode>;
  deleteNodeIds: string[];
  setChildren: TreeChildrenPatch[];
};

export function applyTreeDelta<
  TSnap extends TreeSnapshotLike<TNode>,
  TNode extends { childIds: string[] },
>(snapshot: TSnap, delta: TreeDeltaLike<TNode>): TSnap {
  const nodes = { ...snapshot.nodes };
  for (const nodeId of delta.deleteNodeIds) {
    delete nodes[nodeId];
  }
  for (const [nodeId, node] of Object.entries(delta.putNodes)) {
    nodes[nodeId] = {
      ...node,
      childIds: [...node.childIds],
    };
  }
  for (const patch of delta.setChildren) {
    const current = nodes[patch.parentId];
    if (current === undefined) {
      continue;
    }
    nodes[patch.parentId] = {
      ...current,
      childIds: [...patch.childIds],
    };
  }
  return {
    ...snapshot,
    nodes,
  };
}
