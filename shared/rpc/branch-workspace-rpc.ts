import type { RpcTarget } from "capnweb";

import type { AiChatHandle } from "./ai-rpc";
import type { HistoryHandle } from "./history-rpc";
import type { ManuscriptHandle } from "./manuscript-rpc";
import type { ResourceLibraryHandle } from "./resource-library-rpc";
import type { WorktreeChangesHandle } from "./worktree-changes-rpc";
import type { WorktreeSearchHandle } from "./worktree-search-rpc";

/** Live RPC handle for a branch-scoped draft workspace (SQLite-backed in app userData). */
export interface BranchWorkspace extends RpcTarget {
  readonly ai: AiChatHandle;
  readonly resources: ResourceLibraryHandle;
  readonly manuscript: ManuscriptHandle;
  readonly search: WorktreeSearchHandle;
  readonly changes: WorktreeChangesHandle;
  readonly history: HistoryHandle;
}
