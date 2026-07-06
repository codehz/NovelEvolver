import { RpcTarget } from "capnweb";

import type { Change, ChangesSnapshot } from "#shared/rpc/worktree-changes-rpc";
import type {
  TimelineEntry,
  TimelineEntryContent,
  TimelineTarget,
  WorktreeTimelineHandle,
} from "#shared/rpc/worktree-timeline-rpc";

import type { WorktreeSession } from "../worktree/session";

export class WorktreeTimelineHandleImpl extends RpcTarget implements WorktreeTimelineHandle {
  readonly #session: WorktreeSession;

  constructor(session: WorktreeSession) {
    super();
    this.#session = session;
  }

  listFileTimeline(target: TimelineTarget, limit?: number): TimelineEntry[] {
    return this.#session.listFileTimeline(target, limit);
  }

  readTimelineEntryContent(entryId: string): TimelineEntryContent {
    return this.#session.readTimelineEntryContent(entryId);
  }

  restoreTimelineEntryContent(entryId: string): ChangesSnapshot {
    return this.#convertScmSnapshotToChangesSnapshot(
      this.#session.restoreTimelineEntryContent(entryId),
    );
  }

  #convertScmSnapshotToChangesSnapshot(scmSnapshot: {
    revision: number;
    baseTree: string;
    hasChanges: boolean;
    warning: string | null;
    manuscriptChanges: Array<{
      id: string;
      domain: string;
      kind: string;
      entityId: string;
      entityKind: string;
      label: string;
      displayPath: string;
      depth: number;
      stats?: { added: number; removed: number };
      previousLabel?: string;
      previousPath?: string;
    }>;
    resourceChanges: Array<{
      id: string;
      domain: string;
      kind: string;
      entityId: string;
      entityKind: string;
      label: string;
      displayPath: string;
      depth: number;
      stats?: { added: number; removed: number };
      previousLabel?: string;
      previousPath?: string;
    }>;
  }): ChangesSnapshot {
    const addOrder = (changes: typeof scmSnapshot.manuscriptChanges) =>
      changes
        .sort((left, right) => left.displayPath.localeCompare(right.displayPath))
        .map((change, index) => ({ ...change, order: index }));

    return {
      revision: scmSnapshot.revision,
      baseTree: scmSnapshot.baseTree,
      hasChanges: scmSnapshot.hasChanges,
      warning: scmSnapshot.warning,
      manuscriptChanges: addOrder(scmSnapshot.manuscriptChanges).map((change) => ({
        ...change,
        domain: change.domain as "manuscript" | "resource",
        kind: change.kind as "create" | "delete" | "rename" | "move" | "reorder" | "content",
        entityKind: change.entityKind as "chapter" | "folder" | "file",
      })) as Change[],
      resourceChanges: addOrder(scmSnapshot.resourceChanges).map((change) => ({
        ...change,
        domain: change.domain as "manuscript" | "resource",
        kind: change.kind as "create" | "delete" | "rename" | "move" | "reorder" | "content",
        entityKind: change.entityKind as "chapter" | "folder" | "file",
      })) as Change[],
    };
  }
}
