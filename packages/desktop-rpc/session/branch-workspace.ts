import type { RpcTarget } from "capnweb";

import type { HistoryHandle } from "#desktop-rpc/worktree/history-handle";
import type { ManuscriptHandle } from "#desktop-rpc/worktree/manuscript-handle";
import type { ResourceLibraryHandle } from "#desktop-rpc/worktree/resource-library-handle";
import type { WorktreeChangesHandle } from "#desktop-rpc/worktree/worktree-changes-handle";
import type { WorktreeSearchHandle } from "#desktop-rpc/worktree/worktree-search-handle";
import type { WorktreeTransferInput, WorktreeTransferResult } from "#domain/worktree/transfer";

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
