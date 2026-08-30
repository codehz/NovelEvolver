import type { RpcTarget } from "capnweb";

import type { HistoryHandle } from "../worktree/history-rpc";
import type { ManuscriptHandle } from "../worktree/manuscript-rpc";
import type { ResourceLibraryHandle } from "../worktree/resource-library-rpc";
import type { WorktreeTransferInput, WorktreeTransferResult } from "../worktree/transfer";
import type { WorktreeChangesHandle } from "../worktree/worktree-changes-rpc";
import type { WorktreeSearchHandle } from "../worktree/worktree-search-rpc";

/** Live RPC handle for a branch-scoped draft workspace (SQLite-backed in app userData). */
export interface BranchWorkspace extends RpcTarget {
  readonly resources: ResourceLibraryHandle;
  readonly manuscript: ManuscriptHandle;
  readonly search: WorktreeSearchHandle;
  readonly changes: WorktreeChangesHandle;
  readonly history: HistoryHandle;

  /**
   * Atomically move a node (and its subtree) between manuscript and resource library.
   * Single journal revision: delete source + create target. Fails entirely on conflict.
   */
  transferNode(input: WorktreeTransferInput): WorktreeTransferResult;
}
