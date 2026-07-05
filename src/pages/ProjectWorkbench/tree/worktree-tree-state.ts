import type {
  ManuscriptTreeDelta,
  ManuscriptTreeSnapshot,
  ResourceTreeDelta,
  ResourceTreeSnapshot,
  WorktreeTreeDeltaEvent,
  WorktreeTreeEvent,
  WorktreeTreeSnapshot,
} from "#shared/rpc/worktree-tree";

function applyManuscriptTreeDelta(
  snapshot: ManuscriptTreeSnapshot,
  delta: ManuscriptTreeDelta,
): ManuscriptTreeSnapshot {
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
    rootId: snapshot.rootId,
    nodes,
  };
}

function applyResourceTreeDelta(
  snapshot: ResourceTreeSnapshot,
  delta: ResourceTreeDelta,
): ResourceTreeSnapshot {
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
    rootId: snapshot.rootId,
    nodes,
  };
}

export function applyWorktreeTreeDelta(
  snapshot: WorktreeTreeSnapshot,
  delta: WorktreeTreeDeltaEvent,
): WorktreeTreeSnapshot {
  return {
    revision: delta.toRevision,
    manuscript:
      delta.manuscript === undefined
        ? snapshot.manuscript
        : applyManuscriptTreeDelta(snapshot.manuscript, delta.manuscript),
    resources:
      delta.resources === undefined
        ? snapshot.resources
        : applyResourceTreeDelta(snapshot.resources, delta.resources),
  };
}

export function applyWorktreeTreeEvent(
  current: WorktreeTreeSnapshot | null,
  event: WorktreeTreeEvent,
): WorktreeTreeSnapshot {
  if (event.kind === "snapshot" || current === null) {
    return event.kind === "snapshot"
      ? event.snapshot
      : {
          revision: event.toRevision,
          manuscript: { rootId: "root", nodes: {} },
          resources: { rootId: "root", nodes: {} },
        };
  }
  return applyWorktreeTreeDelta(current, event);
}
