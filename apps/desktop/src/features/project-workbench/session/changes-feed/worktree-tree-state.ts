import type { ChangesEvent } from "#domain/worktree";
import type {
  ManuscriptTreeDelta,
  ManuscriptTreeSnapshot,
  ResourceTreeDelta,
  ResourceTreeSnapshot,
  WorktreeTreeDeltaEvent,
  WorktreeTreeSnapshot,
} from "#domain/worktree";

import { applyTreeDelta } from "./apply-tree-delta";

export function applyManuscriptTreeDelta(
  snapshot: ManuscriptTreeSnapshot,
  delta: ManuscriptTreeDelta,
): ManuscriptTreeSnapshot {
  return applyTreeDelta(snapshot, delta);
}

export function applyResourceTreeDelta(
  snapshot: ResourceTreeSnapshot,
  delta: ResourceTreeDelta,
): ResourceTreeSnapshot {
  return applyTreeDelta(snapshot, delta);
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
  event: ChangesEvent,
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
