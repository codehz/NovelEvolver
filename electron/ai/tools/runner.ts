import type { ToolCallItem } from "@codehz/ai";

import { toErrorMessage } from "../ai-utils";
import { TOOL_SPEC_BY_NAME } from "./catalog";
import { err, okJson, pendingUserInput } from "./result";
import {
  isUserInputRequest,
  type ResolveWorktree,
  type ToolExecutionResult,
  type ToolRunner,
} from "./types";

export type { ResolveWorktree, ToolExecutionResult, ToolRunner } from "./types";

export function createToolRunner(resolveWorktree: ResolveWorktree): ToolRunner {
  return {
    async execute(call: ToolCallItem): Promise<ToolExecutionResult> {
      const spec = TOOL_SPEC_BY_NAME.get(call.name);
      if (!spec) {
        return err(call, `Unknown tool: ${call.name}`);
      }
      try {
        const output = spec.run({
          worktree: resolveWorktree(),
          call,
        });
        if (isUserInputRequest(output)) {
          return pendingUserInput(call, output);
        }
        return okJson(call, output);
      } catch (error) {
        return err(call, toErrorMessage(error));
      }
    },
  };
}
