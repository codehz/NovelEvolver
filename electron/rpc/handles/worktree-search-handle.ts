import { RpcTarget } from "capnweb";

import type {
  WorktreeReplaceQuery,
  WorktreeReplaceResult,
  WorktreeSearchHandle,
  WorktreeSearchQuery,
  WorktreeSearchResult,
} from "#shared/rpc/worktree/index";

import type { WorktreeSession } from "../../worktree/session";

export class WorktreeSearchHandleImpl extends RpcTarget implements WorktreeSearchHandle {
  readonly #session: WorktreeSession;

  constructor(session: WorktreeSession) {
    super();
    this.#session = session;
  }

  search(options: WorktreeSearchQuery): WorktreeSearchResult {
    return this.#session.searchWorktree(options);
  }

  replace(options: WorktreeReplaceQuery): WorktreeReplaceResult {
    return this.#session.replaceInWorktree(options);
  }
}
