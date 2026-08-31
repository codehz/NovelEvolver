import type {
  ChangesEvent,
  ChangesSnapshot,
  ChangesTreeDelta,
} from "@novelevolver/domain/worktree";

import { buildJournalChangesSnapshot } from "../journal/journal-pending-projector";
import { cloneManuscriptTreeSnapshot, cloneResourceTreeSnapshot } from "../trees/tree-clone";
import {
  computeManuscriptTreeDelta,
  computeResourceTreeDelta,
  isEmptyManuscriptTreeDelta,
  isEmptyResourceTreeDelta,
} from "../trees/tree-delta";
import { resolveBaseTree } from "./helpers";
import type { WorktreeSessionState } from "./state";

export function currentChangesOnlySnapshot(state: WorktreeSessionState): ChangesSnapshot {
  return buildJournalChangesSnapshot({
    revision: state.revision,
    baseTree: resolveBaseTree(state),
    warning: state.warning,
    baseManuscript: state.baseManuscript,
    currentManuscript: state.currentManuscript,
    baseResources: state.baseResources,
    currentResources: state.currentResources,
  });
}

export function currentChangesSnapshot(state: WorktreeSessionState): ChangesEvent {
  const changesSnapshot = currentChangesOnlySnapshot(state);
  return {
    kind: "snapshot",
    snapshot: changesSnapshot,
    treeSnapshot: {
      manuscript: state.manuscriptTree,
      resources: state.resourceTree,
    },
  };
}

export function resetChangesStreamBaseline(state: WorktreeSessionState): void {
  state.lastPublishedManuscriptTree = null;
  state.lastPublishedResourceTree = null;
}

export function recordChangesStreamEmit(
  state: WorktreeSessionState,
  changesSnapshot: ChangesSnapshot,
): void {
  state.changeTracker.markChangesEmitted(changesSnapshot);
  state.lastPublishedManuscriptTree = cloneManuscriptTreeSnapshot(state.manuscriptTree);
  state.lastPublishedResourceTree = cloneResourceTreeSnapshot(state.resourceTree);
}

export function buildChangesSnapshotEvent(
  state: WorktreeSessionState,
  changesSnapshot: ChangesSnapshot,
): Extract<ChangesEvent, { kind: "snapshot" }> {
  return {
    kind: "snapshot",
    snapshot: changesSnapshot,
    treeSnapshot: {
      manuscript: cloneManuscriptTreeSnapshot(state.manuscriptTree),
      resources: cloneResourceTreeSnapshot(state.resourceTree),
    },
  };
}

export function buildTreeDeltaFromLastPublished(
  state: WorktreeSessionState,
): ChangesTreeDelta | undefined {
  if (state.lastPublishedManuscriptTree === null || state.lastPublishedResourceTree === null) {
    return undefined;
  }
  const treeDelta: ChangesTreeDelta = {};
  const manuscriptDelta = computeManuscriptTreeDelta(
    state.lastPublishedManuscriptTree,
    state.manuscriptTree,
  );
  if (manuscriptDelta !== undefined && !isEmptyManuscriptTreeDelta(manuscriptDelta)) {
    treeDelta.manuscript = manuscriptDelta;
  }
  const resourceDelta = computeResourceTreeDelta(
    state.lastPublishedResourceTree,
    state.resourceTree,
  );
  if (resourceDelta !== undefined && !isEmptyResourceTreeDelta(resourceDelta)) {
    treeDelta.resources = resourceDelta;
  }
  return Object.keys(treeDelta).length > 0 ? treeDelta : undefined;
}

export function emitChanges(state: WorktreeSessionState): void {
  const currentSnapshot = currentChangesSnapshot(state);
  if (currentSnapshot.kind !== "snapshot") {
    return;
  }
  const changesSnapshot = currentSnapshot.snapshot;

  const needsFullSnapshot =
    state.lastPublishedManuscriptTree === null ||
    state.lastPublishedResourceTree === null ||
    !state.changeTracker.hasEmittedChanges();

  if (needsFullSnapshot) {
    const event = buildChangesSnapshotEvent(state, changesSnapshot);
    state.changesPublisher.emit(event);
    recordChangesStreamEmit(state, changesSnapshot);
    return;
  }

  const delta = state.changeTracker.computeDelta(changesSnapshot, state.revision);
  if (delta.addedChanges.length === 0 && delta.removedChangeIds.length === 0) {
    const event = buildChangesSnapshotEvent(state, changesSnapshot);
    state.changesPublisher.emit(event);
    recordChangesStreamEmit(state, changesSnapshot);
    return;
  }

  state.changesPublisher.emit({
    kind: "delta",
    delta: {
      fromRevision: delta.fromRevision,
      toRevision: delta.toRevision,
      addedChanges: delta.addedChanges,
      removedChangeIds: delta.removedChangeIds,
    },
    treeDelta: buildTreeDeltaFromLastPublished(state),
  });
  recordChangesStreamEmit(state, changesSnapshot);
}
