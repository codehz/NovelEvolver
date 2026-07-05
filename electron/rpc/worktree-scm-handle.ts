import { RpcTarget } from "capnweb";

import type { WorktreeScmHandle, ScmSnapshot } from "#shared/rpc/worktree-scm";

import type { WorktreeSession } from "../worktree/session";

export class WorktreeScmHandleImpl extends RpcTarget implements WorktreeScmHandle {
  readonly #session: WorktreeSession;

  constructor(session: WorktreeSession) {
    super();
    this.#session = session;
  }

  async subscribeSnapshot(): Promise<ReadableStream<ScmSnapshot>> {
    return this.#session.subscribeScmSnapshot();
  }

  revertChange(changeId: string): ScmSnapshot {
    return this.#session.revertScmChange(changeId);
  }

  commit(message: string, author: { name: string; email: string }): ScmSnapshot {
    return this.#session.commitScm(message, author);
  }
}
