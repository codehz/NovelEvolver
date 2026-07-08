import type { ToolCallItem } from "@codehz/ai";

export type AskUserArgs = {
  question: string;
  context?: string;
  placeholder?: string;
};

export type AskUserResult = {
  question: string;
  context: string | null;
  placeholder: string | null;
  answer: string;
};

export function parseAskUserArgs(call: ToolCallItem): AskUserArgs {
  const args = parseToolArguments(call);
  if (typeof args.question !== "string" || args.question.trim() === "") {
    throw new Error("ask_user 需要非空 question。");
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
  };
}

function parseToolArguments(call: ToolCallItem): Record<string, unknown> {
  if (
    call.argumentsJson !== undefined &&
    typeof call.argumentsJson === "object" &&
    call.argumentsJson !== null
  ) {
    return call.argumentsJson as Record<string, unknown>;
  }

  const argumentsText = call.argumentsText.trim();
  if (argumentsText === "") {
    return {};
  }

  return JSON.parse(argumentsText) as Record<string, unknown>;
}
