import type { RpcSubscriptionResult } from "@novelevolver/desktop-rpc/transport/stream";
import type {
  ChangeTextComparison,
  ChangeTextComparisonTarget,
  ChangesEvent,
  ChangesSnapshot,
} from "@novelevolver/domain/worktree/changes";
import type { RpcTarget } from "capnweb";

export interface WorktreeChangesHandle extends RpcTarget {
  subscribeChanges(): RpcSubscriptionResult<ChangesEvent>;
  revertChange(changeId: string): ChangesSnapshot;
  /** Atomically restore the working tree to base (all pending changes). */
  revertAllChanges(): ChangesSnapshot;
  readChangeTextComparison(changeId: string): ChangeTextComparison;
  readChangeTextComparisonByTarget(target: ChangeTextComparisonTarget): ChangeTextComparison;
  restoreChangeTextHunk(
    target: ChangeTextComparisonTarget,
    expectedContent: string,
    nextContent: string,
  ): void;
  commit(message: string, author: { name: string; email: string }): ChangesSnapshot;
}
