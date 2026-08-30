import type { RpcTarget } from "capnweb";

import type {
  WorktreeReplaceQuery,
  WorktreeReplaceResult,
  WorktreeSearchQuery,
  WorktreeSearchResult,
} from "#domain/worktree/search";

/**
 * 当前分支 worktree 内的全文搜索（只读，不订阅）。
 *
 * 搜索范围由 `scope` 控制；`manuscript` 与 `resources` 在结果中始终分字段返回。
 */
export interface WorktreeSearchHandle extends RpcTarget {
  search(options: WorktreeSearchQuery): WorktreeSearchResult;
  replace(options: WorktreeReplaceQuery): WorktreeReplaceResult;
}
