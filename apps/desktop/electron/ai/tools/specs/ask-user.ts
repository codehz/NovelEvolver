import type { ToolCallItem } from "@codehz/ai";

import type {
  AiChatInteractionAnswer,
  AskUserChoice,
  AskUserOpenInteraction,
} from "#shared/rpc/ai/index";

import { parseNonEmptyString, parseToolArgs } from "../parse";
import { rejectedToolResult, successToolResult } from "../result";
import type { ToolSpec, UserInputRequest } from "../types";

export type AskUserArgs = {
  question: string;
  context?: string;
  placeholder?: string;
  choices?: AskUserChoice[];
};

/** 由已解析参数组装客户端可用的开放交互 DTO（无 handle）。 */
export function toAskUserOpenInteraction(id: string, args: AskUserArgs): AskUserOpenInteraction {
  return {
    id,
    kind: "ask_user",
    toolName: "ask_user",
    prompt: args.question,
    question: args.question,
    context: args.context ?? null,
    placeholder: args.placeholder ?? null,
    choices: args.choices ?? null,
  };
}

export function parseAskUserArgs(call: ToolCallItem): AskUserArgs {
  const args = parseToolArgs(call);
  const question = parseNonEmptyString(args.question, "question").trim();

  const choices = parseChoices(args.choices);
  if (choices !== undefined && choices.length === 0) {
    throw new Error("ask_user 的 choices 需要至少包含一个有效选项。");
  }

  return {
    question,
    context:
      typeof args.context === "string" && args.context.trim() !== ""
        ? args.context.trim()
        : undefined,
    placeholder:
      typeof args.placeholder === "string" && args.placeholder.trim() !== ""
        ? args.placeholder.trim()
        : undefined,
    choices,
  };
}

function parseChoices(value: unknown): AskUserChoice[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error("ask_user 的 choices 必须是对象数组。");
  }

  const choices: AskUserChoice[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      throw new Error("ask_user 的 choices 必须是对象数组。");
    }

    const record = item as Record<string, unknown>;
    if (typeof record.title !== "string" || record.title.trim() === "") {
      throw new Error("ask_user 的 choices 每一项都需要非空 title。");
    }

    const choice: AskUserChoice = {
      title: record.title.trim(),
    };
    if (typeof record.description === "string" && record.description.trim() !== "") {
      choice.description = record.description.trim();
    }
    choices.push(choice);
  }

  return choices;
}

function buildUserInputRequest(call: ToolCallItem, args: AskUserArgs): UserInputRequest {
  return {
    toolName: call.name,
    prompt: args.question,
    serializable: { toolName: call.name, args },
  };
}

function parseSerializableArgs(serializable: { args: unknown }): AskUserArgs {
  const call: ToolCallItem = {
    type: "tool_call",
    id: "rebuild",
    name: "ask_user",
    argumentsText: JSON.stringify(serializable.args),
  };
  return parseAskUserArgs(call);
}

export const askUserSpec: ToolSpec<"ask_user"> = {
  name: "ask_user",
  definition: {
    description:
      "仅当继续执行所必需的信息缺失或需要用户确认时调用。一次只问一个明确问题；choices 仅作快捷建议，用户仍可自由输入。调用后等待回答，不要假设答案。",
    inputSchema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "展示给用户的问题文本，应该简洁明确。",
        },
        context: {
          type: "string",
          description: "可选的补充说明，帮助用户理解为什么需要这个信息。",
        },
        placeholder: {
          type: "string",
          description: "可选的输入框占位提示。",
        },
        choices: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "选项标题，点击后可快速填入回答。",
              },
              description: {
                type: "string",
                description: "可选的补充解释，帮助用户理解该选项。",
              },
            },
            required: ["title"],
            additionalProperties: false,
          },
          description: "可选的参考选项列表，为用户提供快速填入；用户仍可自由输入其他答案。",
        },
      },
      required: ["question"],
      additionalProperties: false,
    },
  },
  run({ call }) {
    return buildUserInputRequest(call, parseAskUserArgs(call));
  },
  userInput: {
    createOpenInteraction(id, serializable) {
      return toAskUserOpenInteraction(id, parseSerializableArgs(serializable));
    },
    resolveAnswer(id, answer: AiChatInteractionAnswer) {
      if (answer.kind !== "ask_user") {
        return null;
      }
      const text = answer.text.trim();
      if (text === "") {
        return null;
      }
      return successToolResult(id, "ask_user", { answer: text });
    },
    resolveCancel(id) {
      return rejectedToolResult(id, "ask_user", "用户取消了回答。");
    },
  },
};
