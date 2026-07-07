import { RpcTarget } from "capnweb";

import type {
  CommitSummary,
  HistoryEntry,
  HistoryEntryContent,
  HistoryHandle,
  HistoryTarget,
} from "#shared/rpc/history-rpc";

import type { WorktreeSession } from "../../worktree/session";

export class HistoryHandleImpl extends RpcTarget implements HistoryHandle {
  readonly #session: WorktreeSession;

  constructor(session: WorktreeSession) {
    super();
    this.#session = session;
  }

  listCommits(maxCount?: number): CommitSummary[] {
    return this.#session.listBranchCommits(maxCount);
  }

  listFileHistory(target: HistoryTarget, limit?: number): HistoryEntry[] {
    return this.#session.listFileHistory(target, limit);
  }

  readHistoryEntryContent(entryId: string): HistoryEntryContent {
    return this.#session.readHistoryEntryContent(entryId);
  }

  restoreHistoryEntryContentHunk(
    entryId: string,
    expectedContent: string,
    nextContent: string,
  ): void {
    this.#session.restoreHistoryEntryContentHunk(entryId, expectedContent, nextContent);
  }
}
