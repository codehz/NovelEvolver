import type { HistoryHandle } from "@novelevolver/desktop-rpc/worktree/history-handle";
import type {
  ChangeTextComparisonTarget,
  ChangesSnapshot,
} from "@novelevolver/domain/worktree/changes";
import type {
  CommitChangeTextComparison,
  CommitChangesSnapshot,
  CommitSummary,
  HistoryEntry,
  HistoryEntryContent,
  HistoryTarget,
} from "@novelevolver/domain/worktree/history";
import type { WorktreeSession } from "@novelevolver/worktree";
import { RpcTarget } from "capnweb";

export class HistoryHandleImpl extends RpcTarget implements HistoryHandle {
  readonly #session: WorktreeSession;

  constructor(session: WorktreeSession) {
    super();
    this.#session = session;
  }

  listCommits(maxCount?: number): CommitSummary[] {
    return this.#session.listBranchCommits(maxCount);
  }

  listCommitChanges(commitHash: string): CommitChangesSnapshot {
    return this.#session.listCommitChanges(commitHash);
  }

  readCommitChangeTextComparison(
    commitHash: string,
    target: ChangeTextComparisonTarget,
  ): CommitChangeTextComparison {
    return this.#session.readCommitChangeTextComparison(commitHash, target);
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

  restoreWorkingTreeFromCommit(commitHash: string): ChangesSnapshot {
    return this.#session.restoreWorkingTreeFromCommit(commitHash);
  }

  restoreEntityFromCommit(commitHash: string, target: HistoryTarget): ChangesSnapshot {
    return this.#session.restoreEntityFromCommit(commitHash, target);
  }

  restoreEntityFromHistoryEntry(entryId: string): ChangesSnapshot {
    return this.#session.restoreEntityFromHistoryEntry(entryId);
  }
}
