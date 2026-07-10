import type { ToolCallItem } from "@codehz/ai";

import { parseToolArgs } from "./utils";

export type AskUserChoice = {
  title: string;
  description?: string;
};

export type AskUserArgs = {
  question: string;
  context?: string;
  placeholder?: string;
  choices?: AskUserChoice[];
};

export type AskUserResult = {
  answer: string;
};

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
