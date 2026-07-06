import { RpcTarget } from "capnweb";

import type {
  TimelineEntry,
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
}
