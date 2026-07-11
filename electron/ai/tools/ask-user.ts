import type { ToolCallItem, ToolResultItem } from "@codehz/ai";
import { toolResultItem } from "@codehz/ai";
import { RpcTarget } from "capnweb";

import type {
  AskUserChoice,
  AskUserPendingInput,
  AskUserRequestHandle,
} from "#shared/rpc/ai/index";

import type { UserInputResolver } from "./user-input-types";
import { parseToolArgs } from "./utils";

export type AskUserArgs = {
  question: string;
  context?: string;
  placeholder?: string;
  choices?: AskUserChoice[];
};

export type AskUserResult = {
  answer: string;
};

/**
 * `ask_user` 工具的 typed handle 实现。
 *
 * 只暴露 `submitAnswer`/`cancel`（Cap'n Web 按引用）。展示字段由
 * `toAskUserPendingInput` 打成纯 DTO 随事件按值推送。
 * 幂等：首次调用后 resolver 即置空，后续调用静默忽略。
 */
export class AskUserRequestHandleImpl extends RpcTarget implements AskUserRequestHandle {
  #callId: string;
  #resolver: UserInputResolver | null;

  constructor(call: ToolCallItem, resolver: UserInputResolver) {
    super();
    this.#callId = call.id;
    this.#resolver = resolver;
  }

  submitAnswer(text: string): void {
    const resolver = this.#resolver;
    if (resolver === null) {
      return;
    }
    this.#resolver = null;
    const result: ToolResultItem = toolResultItem(this.#callId, "ask_user", "success", [
      { type: "json", json: { answer: text } },
    ]);
    resolver.resolve(result);
  }

  cancel(): void {
    const resolver = this.#resolver;
    if (resolver === null) {
      return;
    }
    this.#resolver = null;
    const result: ToolResultItem = toolResultItem(this.#callId, "ask_user", "rejected", [
      { type: "text", text: "用户取消了回答。" },
    ]);
    resolver.resolve(result);
  }
}

/** 由已解析参数与 handle 组装客户端可用的 pending input 视图。 */
export function toAskUserPendingInput(
  args: AskUserArgs,
  handle: AskUserRequestHandle,
): AskUserPendingInput {
  return {
    kind: "ask_user",
    toolName: "ask_user",
    prompt: args.question,
    question: args.question,
    context: args.context ?? null,
    placeholder: args.placeholder ?? null,
    choices: args.choices ?? null,
    handle,
  };
}

export function parseAskUserArgs(call: ToolCallItem): AskUserArgs {
  const args = parseToolArgs(call);
  if (typeof args.question !== "string" || args.question.trim() === "") {
    throw new Error("ask_user 需要非空 question。");
  }

  const choices = parseChoices(args.choices);
  if (choices !== undefined && choices.length === 0) {
    throw new Error("ask_user 的 choices 需要至少包含一个有效选项。");
  }

  return {
    question: args.question.trim(),
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
