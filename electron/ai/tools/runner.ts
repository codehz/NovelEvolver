import type { ToolCallItem, ToolResultItem } from "@codehz/ai";
import { toolResultItem } from "@codehz/ai";

import type { WorktreeSession } from "../../worktree/session";
import { toErrorMessage } from "../ai-utils";
import { parseAskUserArgs } from "./ask-user";
import { type AI_TOOL_NAMES } from "./definitions";
import { executeReadResourceFile } from "./read-resource-file";
import { executeListResourceFiles } from "./resource-library";

export type UserInputRequest = {
  /** 发起该请求的工具名，供前端按 toolName 分派 UI 组件。 */
  toolName: string;
  /** 展示给用户的简短提示（如问题标题）。 */
  prompt: string;
  /** 工具自定义的渲染数据，透传给前端对应组件。 */
  payload: Record<string, unknown>;
};

export type ToolExecutionResult = {
  toolResult: ToolResultItem;
  resultText: string | null;
  errorMessage: string | null;
  userInputRequest?: UserInputRequest;
};

export type ResolveWorktree = () => WorktreeSession;

export type ToolRunner = {
  execute(call: ToolCallItem): Promise<ToolExecutionResult>;
  /** 将用户输入的纯文本构造为 tool_result item，返回给 AI 模型。 */
  buildUserInputResult(call: ToolCallItem, userText: string): ToolResultItem;
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
      payload: {
        question: args.question,
        context: args.context ?? null,
        placeholder: args.placeholder ?? null,
        choices: args.choices ?? null,
      },
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
    buildUserInputResult(call: ToolCallItem, userText: string): ToolResultItem {
      // Default: wrap as { answer } JSON (compatible with ask_user tool contract).
      // Specific tools can override by checking call.name in a custom ToolRunner.
      return toolResultItem(call.id, call.name, "success", [
        { type: "json", json: { answer: userText } },
      ]);
    },
  };
}
