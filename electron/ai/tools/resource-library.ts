import type { ToolCallItem } from "@codehz/ai";

import type { WorktreeSession } from "../../worktree/session";
import type { ResourceFileListEntry } from "../../worktree/session/resource-ops";
import { parseToolArgs } from "./utils";

export type ListResourceFilesArgs = {
  path?: string;
};

export type ListResourceFilesResult = {
  files: ResourceFileListEntry[];
};

export function executeListResourceFiles(
  worktree: WorktreeSession,
  call: ToolCallItem,
): ListResourceFilesResult {
  const args = parseToolArgs(call) as ListResourceFilesArgs;
  const path = typeof args.path === "string" ? args.path : "";
  return {
    files: worktree.listResourceFiles(path),
  };
}
