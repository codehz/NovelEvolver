import type { ToolCallItem } from "@codehz/ai";

import type { WorktreeSession } from "../../worktree/session";
import type { ResourceFileListEntry } from "../../worktree/session/resource-ops";

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
  const args = parseListResourceFilesArgs(call);
  const path = typeof args.path === "string" ? args.path : "";
  return {
    files: worktree.listResourceFiles(path),
  };
}

function parseListResourceFilesArgs(call: ToolCallItem): ListResourceFilesArgs {
  if (
    call.argumentsJson !== undefined &&
    typeof call.argumentsJson === "object" &&
    call.argumentsJson !== null
  ) {
    return call.argumentsJson as ListResourceFilesArgs;
  }

  const argumentsText = call.argumentsText.trim();
  if (argumentsText === "") {
    return {};
  }

  return JSON.parse(argumentsText) as ListResourceFilesArgs;
}
