import type { ToolCallItem } from "@codehz/ai";

import type { WorktreeSession } from "../../worktree/session";
import { parseToolArgs } from "./utils";

export type ReadResourceFileArgs = {
  path?: string;
};

export function executeReadResourceFile(worktree: WorktreeSession, call: ToolCallItem): string {
  const args = parseToolArgs(call) as ReadResourceFileArgs;
  if (typeof args.path !== "string") {
    throw new Error("read_resource_file 需要非空 path。");
  }
  return worktree.readResourceFileByPath(args.path);
}
