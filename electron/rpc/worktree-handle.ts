import { RpcTarget } from "capnweb";

import type { ManuscriptHandle } from "#shared/rpc/manuscript-rpc";
import type { WorktreeHandle } from "#shared/rpc/projects-rpc";
import type { ResourceLibraryHandle } from "#shared/rpc/resource-library-rpc";
import type { WorktreeChangesHandle } from "#shared/rpc/worktree-changes-rpc";
import type { WorktreeSearchHandle } from "#shared/rpc/worktree-search-rpc";
import type { WorktreeTimelineHandle } from "#shared/rpc/worktree-timeline-rpc";

import type { WorktreeSession } from "../worktree/session";
import { ManuscriptHandleImpl } from "./manuscript-handle";
import { ResourceLibraryHandleImpl } from "./resource-library-handle";
import { WorktreeChangesHandleImpl } from "./worktree-changes-handle";
import { WorktreeSearchHandleImpl } from "./worktree-search-handle";
import { WorktreeTimelineHandleImpl } from "./worktree-timeline-handle";

/**
 * Server-side RPC target wrapping a SQLite-backed branch worktree session.
 */
export class WorktreeHandleImpl extends RpcTarget implements WorktreeHandle {
  readonly #session: WorktreeSession;
  readonly #resources: ResourceLibraryHandle;
  readonly #manuscript: ManuscriptHandle;
  readonly #search: WorktreeSearchHandle;
  readonly #changes: WorktreeChangesHandle;
  readonly #timeline: WorktreeTimelineHandle;

  constructor(session: WorktreeSession) {
    super();
    this.#session = session;
    this.#resources = new ResourceLibraryHandleImpl(this.#session);
    this.#manuscript = new ManuscriptHandleImpl(this.#session);
    this.#search = new WorktreeSearchHandleImpl(this.#session);
    this.#changes = new WorktreeChangesHandleImpl(this.#session);
    this.#timeline = new WorktreeTimelineHandleImpl(this.#session);
  }

  get resources(): ResourceLibraryHandle {
    return this.#resources;
  }

  get manuscript(): ManuscriptHandle {
    return this.#manuscript;
  }

  get search(): WorktreeSearchHandle {
    return this.#search;
  }

  get changes(): WorktreeChangesHandle {
    return this.#changes;
  }

  get timeline(): WorktreeTimelineHandle {
    return this.#timeline;
  }
}
