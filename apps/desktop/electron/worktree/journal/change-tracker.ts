import type { Change, ChangesSnapshot } from "#domain/worktree";

/**
 * Tracks the last emitted pending-change snapshot for the streaming protocol.
 * Business projection lives in journal-pending-projector; this class only computes stream deltas.
 */
export class ChangeTracker {
  #lastEmittedChanges: ChangesSnapshot | null = null;

  hasEmittedChanges(): boolean {
    return this.#lastEmittedChanges !== null;
  }

  markChangesEmitted(snapshot: ChangesSnapshot): void {
    this.#lastEmittedChanges = {
      ...snapshot,
      manuscriptChanges: [...snapshot.manuscriptChanges],
      resourceChanges: [...snapshot.resourceChanges],
    };
  }

  computeDelta(
    current: ChangesSnapshot,
    currentRevision: number,
  ): {
    addedChanges: Change[];
    removedChangeIds: string[];
    fromRevision: number;
    toRevision: number;
  } {
    if (this.#lastEmittedChanges === null) {
      return {
        addedChanges: [...current.manuscriptChanges, ...current.resourceChanges],
        removedChangeIds: [],
        fromRevision: currentRevision - 1,
        toRevision: currentRevision,
      };
    }

    const previous = this.#lastEmittedChanges;
    const previousChangeIds = new Set(
      [...previous.manuscriptChanges, ...previous.resourceChanges].map((change) => change.id),
    );
    const currentChangeIds = new Set<string>();
    const addedChanges: Change[] = [];

    for (const change of [...current.manuscriptChanges, ...current.resourceChanges]) {
      currentChangeIds.add(change.id);
      if (!previousChangeIds.has(change.id)) {
        addedChanges.push(change);
      }
    }

    const removedChangeIds = [...previousChangeIds].filter((changeId) => {
      return !currentChangeIds.has(changeId);
    });

    return {
      addedChanges,
      removedChangeIds,
      fromRevision: previous.revision,
      toRevision: currentRevision,
    };
  }

  clearCache(): void {
    this.#lastEmittedChanges = null;
  }
}
