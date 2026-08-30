import { RpcTarget } from "capnweb";

import type {
  ChangeTextComparison,
  ChangeTextComparisonTarget,
  ChangesEvent,
  ChangesSnapshot,
  WorktreeChangesHandle,
} from "#shared/rpc/worktree/index";

import type { WorktreeSession } from "../../worktree/session";

export class WorktreeChangesHandleImpl extends RpcTarget implements WorktreeChangesHandle {
  readonly #session: WorktreeSession;

  constructor(session: WorktreeSession) {
    super();
    this.#session = session;
  }

  async subscribeChanges(): Promise<ReadableStream<ChangesEvent>> {
    return this.#session.subscribeChanges();
  }

  revertChange(changeId: string): ChangesSnapshot {
    return this.#session.revertChange(changeId);
  }

  revertAllChanges(): ChangesSnapshot {
    return this.#session.revertAllChanges();
  }

  readChangeTextComparison(changeId: string): ChangeTextComparison {
    return this.#session.readChangeTextComparison(changeId);
  }

  readChangeTextComparisonByTarget(target: ChangeTextComparisonTarget): ChangeTextComparison {
    return this.#session.readChangeTextComparisonByTarget(target);
  }

  restoreChangeTextHunk(
    target: ChangeTextComparisonTarget,
    expectedContent: string,
    nextContent: string,
  ): void {
    this.#session.restoreChangeTextHunk(target, expectedContent, nextContent);
  }

  commit(message: string, author: { name: string; email: string }): ChangesSnapshot {
    return this.#session.commitChanges(message, author);
  }
}
