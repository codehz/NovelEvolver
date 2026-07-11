import type { ToolCallItem, ToolResultItem } from "@codehz/ai";
import { toolResultItem } from "@codehz/ai";
import { RpcTarget } from "capnweb";

import type { AskUserChoice, AskUserRequestHandle } from "#shared/rpc/ai-rpc";

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
 * 绑定一个 `UserInputResolver`，客户端调用 `submitAnswer`/`cancel` 时构造
 * 对应 `ToolResultItem` 交还 session。幂等：首次调用后 resolver 即置空，
 * 后续调用静默忽略，避免重复提交。
 */
export class AskUserRequestHandleImpl extends RpcTarget implements AskUserRequestHandle {
  readonly kind = "ask_user" as const;
  readonly toolName = "ask_user" as const;
  readonly question: string;
  readonly context: string | null;
  readonly placeholder: string | null;
  readonly choices: AskUserChoice[] | null;
  readonly prompt: string;
  #callId: string;
  #resolver: UserInputResolver | null;

  constructor(call: ToolCallItem, args: AskUserArgs, resolver: UserInputResolver) {
    super();
    this.#callId = call.id;
    this.question = args.question;
    this.context = args.context ?? null;
    this.placeholder = args.placeholder ?? null;
    this.choices = args.choices ?? null;
    this.prompt = args.question;
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
