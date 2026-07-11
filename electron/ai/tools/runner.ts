import type { ToolCallItem, ToolResultItem } from "@codehz/ai";
import { toolResultItem } from "@codehz/ai";

import type { WorktreeSession } from "../../worktree/session";
import { toErrorMessage } from "../ai-utils";
import { AskUserRequestHandleImpl, parseAskUserArgs } from "./ask-user";
import { type AI_TOOL_NAMES } from "./definitions";
import { executeReadResourceFile } from "./read-resource-file";
import { executeListResourceFiles } from "./resource-library";
import type { UserInputRequest } from "./user-input-types";

export type { UserInputRequest, UserInputResolver } from "./user-input-types";

export type ToolExecutionResult = {
  toolResult: ToolResultItem;
  resultText: string | null;
  errorMessage: string | null;
  userInputRequest?: UserInputRequest;
};

export type ResolveWorktree = () => WorktreeSession;

export type ToolRunner = {
  execute(call: ToolCallItem): Promise<ToolExecutionResult>;
};

// ---- result helpers ----

function ok(call: ToolCallItem, resultText: string): ToolExecutionResult {
  return {
    toolResult: toolResultItem(call.id, call.name, "success", [{ type: "text", text: resultText }]),
    resultText,
    errorMessage: null,
  };
}

function okJson(call: ToolCallItem, json: unknown): ToolExecutionResult {
  const resultText = JSON.stringify(json, null, 2);
  return {
    toolResult: toolResultItem(call.id, call.name, "success", [{ type: "json", json }]),
    resultText,
    errorMessage: null,
  };
}

function err(call: ToolCallItem, message: string): ToolExecutionResult {
  return {
    toolResult: toolResultItem(call.id, call.name, "error", [{ type: "text", text: message }]),
    resultText: null,
    errorMessage: message,
  };
}

function askUserResult(
  call: ToolCallItem,
  args: ReturnType<typeof parseAskUserArgs>,
): ToolExecutionResult {
  return {
    toolResult: toolResultItem(call.id, call.name, "rejected", [
      { type: "text", text: "等待用户回答。" },
    ]),
    resultText: null,
    errorMessage: null,
    userInputRequest: {
      toolName: call.name,
      prompt: args.question,
      createHandle: (resolver) => new AskUserRequestHandleImpl(call, args, resolver),
      serializable: { toolName: call.name, args },
    },
  };
}

// ---- handler registry ----

type ToolHandler = (worktree: WorktreeSession, call: ToolCallItem) => ToolExecutionResult;

const toolHandlers: Partial<Record<AI_TOOL_NAMES, ToolHandler>> = {
  ask_user(worktree, call) {
    const args = parseAskUserArgs(call);
    return askUserResult(call, args);
  },
  list_resource_files(worktree, call) {
    const output = executeListResourceFiles(worktree, call);
    return okJson(call, output);
  },
  read_resource_file(worktree, call) {
    const content = executeReadResourceFile(worktree, call);
    return ok(call, content);
  },
};

// ---- runner ----

export function createToolRunner(resolveWorktree: ResolveWorktree): ToolRunner {
  return {
    async execute(call: ToolCallItem): Promise<ToolExecutionResult> {
      const handler = toolHandlers[call.name as AI_TOOL_NAMES];
      if (!handler) {
        return err(call, `Unknown tool: ${call.name}`);
      }
      try {
        return handler(resolveWorktree(), call);
      } catch (error) {
        return err(call, toErrorMessage(error));
      }
    },
  };
}
