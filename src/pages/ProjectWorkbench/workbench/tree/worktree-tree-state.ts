import type { WorktreeChangesEvent } from "#shared/rpc/worktree-changes-rpc";
import type {
  ManuscriptTreeDelta,
  ManuscriptTreeSnapshot,
  ResourceTreeDelta,
  ResourceTreeSnapshot,
  WorktreeTreeDeltaEvent,
  WorktreeTreeSnapshot,
} from "#shared/rpc/worktree-tree-rpc";

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

export function applyCombinedWorktreeTreeFromChangesEvent(
  current: WorktreeTreeSnapshot | null,
  event: WorktreeChangesEvent,
): WorktreeTreeSnapshot | null {
  if (event.kind === "snapshot") {
    return {
      revision: event.snapshot.revision,
      manuscript: event.treeSnapshot.manuscript,
      resources: event.treeSnapshot.resources,
    };
  }
  if (current === null) {
    return null;
  }
  const { treeDelta, delta } = event;
  if (treeDelta === undefined) {
    return { ...current, revision: delta.toRevision };
  }
  return {
    revision: delta.toRevision,
    manuscript:
      treeDelta.manuscript === undefined
        ? current.manuscript
        : applyManuscriptTreeDelta(current.manuscript, treeDelta.manuscript),
    resources:
      treeDelta.resources === undefined
        ? current.resources
        : applyResourceTreeDelta(current.resources, treeDelta.resources),
  };
}
