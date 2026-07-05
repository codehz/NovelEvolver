import { RpcTarget } from "capnweb";

import type { WorktreeScmHandle, ScmSnapshot } from "#shared/rpc/worktree-scm";

import type { ScmSession } from "../scm/session";

export class WorktreeScmHandleImpl extends RpcTarget implements WorktreeScmHandle {
  readonly #session: ScmSession;

  constructor(session: ScmSession) {
    super();
    this.#session = session;
  }

  async subscribeSnapshot(): Promise<ReadableStream<ScmSnapshot>> {
    return this.#session.subscribeSnapshot();
  }

  revertChange(changeId: string): ScmSnapshot {
    return this.#session.revertChange(changeId);
  }

  commit(message: string, author: { name: string; email: string }): ScmSnapshot {
    return this.#session.commit(message, author);
  }
}
