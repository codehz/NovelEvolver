import { RpcTarget } from "capnweb";

import type { WorktreeTreeEvent, WorktreeTreeHandle } from "#shared/rpc/worktree-tree";

import type { WorktreeSession } from "../worktree/session";

export class WorktreeTreeHandleImpl extends RpcTarget implements WorktreeTreeHandle {
  readonly #session: WorktreeSession;

  constructor(session: WorktreeSession) {
    super();
    this.#session = session;
  }

  async subscribe(): Promise<ReadableStream<WorktreeTreeEvent>> {
    return this.#session.subscribeTree();
  }
}
