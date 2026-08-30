import { RpcTarget } from "capnweb";

import type { WorktreeSearchHandle } from "#desktop-rpc/worktree/worktree-search-handle";
import type {
  WorktreeReplaceQuery,
  WorktreeReplaceResult,
  WorktreeSearchQuery,
  WorktreeSearchResult,
} from "#domain/worktree/search";

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
