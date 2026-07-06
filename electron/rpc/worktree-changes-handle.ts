import { RpcTarget } from "capnweb";

import type {
  Change,
  ChangesSnapshot,
  WorktreeChangesEvent,
  WorktreeChangesHandle,
} from "#shared/rpc/worktree-changes-rpc";
import type { ScmSnapshot } from "#shared/rpc/worktree-scm-rpc";

import type { WorktreeSession } from "../worktree/session";

export class WorktreeChangesHandleImpl extends RpcTarget implements WorktreeChangesHandle {
  readonly #session: WorktreeSession;

  constructor(session: WorktreeSession) {
    super();
    this.#session = session;
  }

  async subscribe(): Promise<ReadableStream<WorktreeChangesEvent>> {
    return this.#session.subscribeChanges();
  }

  revertChange(changeId: string): ChangesSnapshot {
    // 复用现有的 revertScmChange 逻辑
    const scmSnapshot = this.#session.revertScmChange(changeId);
    // 转换为 ChangesSnapshot
    return this.#convertScmSnapshotToChangesSnapshot(scmSnapshot);
  }

  commit(message: string, author: { name: string; email: string }): ChangesSnapshot {
    // 复用现有的 commitScm 逻辑
    const scmSnapshot = this.#session.commitScm(message, author);
    // 转换为 ChangesSnapshot
    return this.#convertScmSnapshotToChangesSnapshot(scmSnapshot);
  }

  listCommits(maxCount?: number): {
    hash: string;
    shortHash: string;
    message: string;
    authorName: string;
    committedAt: number;
  }[] {
    return this.#session.listBranchCommits(maxCount);
  }

  #convertScmSnapshotToChangesSnapshot(scmSnapshot: ScmSnapshot): ChangesSnapshot {
    return {
      revision: scmSnapshot.revision,
      baseTree: scmSnapshot.baseTree,
      hasChanges: scmSnapshot.hasChanges,
      warning: scmSnapshot.warning,
      manuscriptChanges: scmSnapshot.manuscriptChanges as Change[],
      resourceChanges: scmSnapshot.resourceChanges as Change[],
    };
  }
}
