import type {
  ChangesEvent,
  ChangesSnapshot,
  WorktreeTreeSnapshot,
} from "@novelevolver/domain/worktree";
import { molecule, use } from "bunshi/react";
import { atom } from "jotai";

import { branchNameScope } from "../branch-scope";
import { projectIdScope } from "../project-scope";
import { applyCombinedWorktreeTreeFromChangesEvent } from "./worktree-tree-state";

export type WorktreeChangesFeedStatus = "loading" | "ready" | "error";

export type WorktreeChangesFeedState = {
  status: WorktreeChangesFeedStatus;
  revision: number;
  changesSnapshot: ChangesSnapshot | null;
  treeSnapshot: WorktreeTreeSnapshot | null;
  /** 单调递增，保证 delta 也能触发消费者 effect。 */
  eventSeq: number;
  lastEvent: ChangesEvent | null;
};

export const initialWorktreeChangesFeedState: WorktreeChangesFeedState = {
  status: "loading",
  revision: 0,
  changesSnapshot: null,
  treeSnapshot: null,
  eventSeq: 0,
  lastEvent: null,
};

export function applyChangesSnapshotEvent(
  previous: ChangesSnapshot | null,
  event: ChangesEvent,
): ChangesSnapshot | null {
  if (event.kind === "snapshot") {
    return event.snapshot;
  }
  if (previous === null) {
    return null;
  }

  const { delta } = event;
  const removedChangeIds = new Set(delta.removedChangeIds);
  const manuscriptChanges = previous.manuscriptChanges.filter(
    (change) => !removedChangeIds.has(change.id),
  );
  const resourceChanges = previous.resourceChanges.filter(
    (change) => !removedChangeIds.has(change.id),
  );

  for (const change of delta.addedChanges) {
    if (change.domain === "manuscript") {
      manuscriptChanges.push(change);
    } else {
      resourceChanges.push(change);
    }
  }

  return {
    ...previous,
    revision: delta.toRevision,
    manuscriptChanges,
    resourceChanges,
    hasChanges: manuscriptChanges.length > 0 || resourceChanges.length > 0,
  };
}

export function reduceWorktreeChangesFeed(
  current: WorktreeChangesFeedState,
  event: ChangesEvent,
): WorktreeChangesFeedState {
  const changesSnapshot = applyChangesSnapshotEvent(current.changesSnapshot, event);
  const treeSnapshot = applyCombinedWorktreeTreeFromChangesEvent(current.treeSnapshot, event);
  const revision = event.kind === "snapshot" ? event.snapshot.revision : event.delta.toRevision;

  return {
    status: "ready",
    revision,
    changesSnapshot,
    treeSnapshot,
    eventSeq: current.eventSeq + 1,
    lastEvent: event,
  };
}

/**
 * 当前分支的 changes 流单点 fan-out。
 * 实际 RPC 订阅由 `useWorktreeChangesFeedSync` 挂载一次；各域只读派生 atom。
 */
export const worktreeChangesFeedMolecule = molecule(() => {
  use(projectIdScope);
  use(branchNameScope);

  const feedAtom = atom<WorktreeChangesFeedState>(initialWorktreeChangesFeedState);
  const retryKeyAtom = atom(0);

  const revisionAtom = atom((get) => get(feedAtom).revision);
  const treeSnapshotAtom = atom((get) => get(feedAtom).treeSnapshot);
  const changesSnapshotAtom = atom((get) => get(feedAtom).changesSnapshot);
  const statusAtom = atom((get) => get(feedAtom).status);
  const lastEventAtom = atom((get) => get(feedAtom).lastEvent);
  const eventSeqAtom = atom((get) => get(feedAtom).eventSeq);

  return {
    feedAtom,
    retryKeyAtom,
    revisionAtom,
    treeSnapshotAtom,
    changesSnapshotAtom,
    statusAtom,
    lastEventAtom,
    eventSeqAtom,
  };
});
