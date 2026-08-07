import type { ToolCallItem } from "@codehz/ai";
import { AIRecoverableError } from "@codehz/ai";

import { toErrorMessage } from "../ai-utils";
import { TOOL_SPEC_BY_NAME } from "./catalog";
import { projectToolView } from "./project-view";
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
        return err(
          call,
          `Unknown tool: ${call.name}`,
          projectToolView({
            name: call.name,
            argumentsText: call.argumentsText,
            errorMessage: `Unknown tool: ${call.name}`,
          }),
        );
      }
      try {
        const output = spec.run({
          worktree: resolveWorktree(),
          call,
        });
        if (isUserInputRequest(output)) {
          return pendingUserInput(
            call,
            output,
            projectToolView({
              name: call.name,
              argumentsText: call.argumentsText,
            }),
          );
        }
        return okJson(
          call,
          output,
          projectToolView({
            name: call.name,
            argumentsText: call.argumentsText,
            result: output,
          }),
        );
      } catch (error) {
        if (error instanceof AIRecoverableError) {
          throw error;
        }
        const message = toErrorMessage(error);
        return err(
          call,
          message,
          projectToolView({
            name: call.name,
            argumentsText: call.argumentsText,
            errorMessage: message,
          }),
        );
      }
    },
  };
}
