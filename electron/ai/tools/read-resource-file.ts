import type { ToolCallItem } from "@codehz/ai";

import type { WorktreeSession } from "../../worktree/session";

export type ReadResourceFileArgs = {
  path?: string;
};

export function executeReadResourceFile(worktree: WorktreeSession, call: ToolCallItem): string {
  const args = parseReadResourceFileArgs(call);
  if (typeof args.path !== "string") {
    throw new Error("read_resource_file 需要非空 path。");
  }
  return worktree.readResourceFileByPath(args.path);
}

function parseReadResourceFileArgs(call: ToolCallItem): ReadResourceFileArgs {
  if (
    call.argumentsJson !== undefined &&
    typeof call.argumentsJson === "object" &&
    call.argumentsJson !== null
  ) {
    return call.argumentsJson as ReadResourceFileArgs;
  }

  const argumentsText = call.argumentsText.trim();
  if (argumentsText === "") {
    return {};
  }

  return JSON.parse(argumentsText) as ReadResourceFileArgs;
}
