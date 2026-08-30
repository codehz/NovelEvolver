import type { WorktreeSearchQuery, WorktreeSearchResult } from "#domain/worktree";

import { executeWorktreeSearch } from "../search";
import type { WorktreeSessionState } from "./state";

export function searchWorktree(
  state: WorktreeSessionState,
  options: WorktreeSearchQuery,
): WorktreeSearchResult {
  return executeWorktreeSearch(
    state.currentManuscript.entries.values(),
    state.currentResources.entries.values(),
    options,
  );
}
