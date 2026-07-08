import type { ToolCallItem, ToolResultItem } from "@codehz/ai";
import { toolResultItem } from "@codehz/ai";

import type { WorktreeSession } from "../../worktree/session";
import { toErrorMessage } from "../ai-utils";
import { LIST_RESOURCE_FILES_TOOL_NAME } from "./definitions";
import { executeListResourceFiles } from "./resource-library";

export type ToolExecutionResult = {
  toolResult: ToolResultItem;
  resultText: string | null;
  errorMessage: string | null;
};

export type ToolRunner = {
  execute(call: ToolCallItem): Promise<ToolExecutionResult>;
};

export function createToolRunner(worktree: WorktreeSession): ToolRunner {
  return {
    async execute(call: ToolCallItem): Promise<ToolExecutionResult> {
      try {
        switch (call.name) {
          case LIST_RESOURCE_FILES_TOOL_NAME: {
            const output = executeListResourceFiles(worktree, call);
            const resultText = JSON.stringify(output, null, 2);
            return {
              toolResult: toolResultItem(call.id, call.name, "success", [
                { type: "json", json: output },
              ]),
              resultText,
              errorMessage: null,
            };
          }
          default:
            return createErrorResult(call, `Unknown tool: ${call.name}`);
        }
      } catch (error) {
        return createErrorResult(call, toErrorMessage(error));
      }
    },
  };
}

function createErrorResult(call: ToolCallItem, message: string): ToolExecutionResult {
  return {
    toolResult: toolResultItem(call.id, call.name, "error", [{ type: "text", text: message }]),
    resultText: null,
    errorMessage: message,
  };
}
