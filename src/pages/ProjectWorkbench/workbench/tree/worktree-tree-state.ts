import type { WorktreeChangesEvent } from "#shared/rpc/worktree-changes";
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

/**
 * 从统一的 changes 事件中提取完整树快照。
 *
 * 后端在 snapshot 与 delta 两种事件中均携带完整树（snapshot 经 `treeSnapshot`，
 * delta 经 `treeDelta`）。若该事件未携带完整树（缺任一半），返回 null，调用方保留旧状态。
 */
export function extractWorktreeTreeFromChanges(
  event: WorktreeChangesEvent,
): WorktreeTreeSnapshot | null {
  if (event.kind === "snapshot") {
    return {
      revision: event.snapshot.revision,
      manuscript: event.treeSnapshot.manuscript,
      resources: event.treeSnapshot.resources,
    };
  }
  const { treeDelta, delta } = event;
  if (treeDelta?.manuscript === undefined || treeDelta?.resources === undefined) {
    return null;
  }
  return {
    revision: delta.toRevision,
    manuscript: treeDelta.manuscript,
    resources: treeDelta.resources,
  };
}
