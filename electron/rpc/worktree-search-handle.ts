import { RpcTarget } from "capnweb";

import type {
  WorktreeSearchHandle,
  WorktreeSearchQuery,
  WorktreeSearchResult,
} from "#shared/rpc/worktree-search";

import type { WorktreeSession } from "../worktree/session";

export class WorktreeSearchHandleImpl extends RpcTarget implements WorktreeSearchHandle {
  readonly #session: WorktreeSession;

  constructor(session: WorktreeSession) {
    super();
    this.#session = session;
  }

  search(options: WorktreeSearchQuery): WorktreeSearchResult {
    return this.#session.searchWorktree(options);
  }
}
