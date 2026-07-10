import type { AiChatSnapshot, AiChatToolCall } from "#shared/rpc/ai-rpc";

export type AskUserToolChoice = {
  title: string;
  description?: string;
};

export type AskUserToolArguments = {
  question?: string;
  context?: string;
  placeholder?: string;
  choices?: AskUserToolChoice[];
};

export function parseAskUserToolArguments(argumentsText: string): AskUserToolArguments | null {
  try {
    const parsed = JSON.parse(argumentsText) as AskUserToolArguments;
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

export function normalizeAskUserChoices(choices: unknown): AskUserToolChoice[] {
  if (!Array.isArray(choices)) {
    return [];
  }

  const normalized: AskUserToolChoice[] = [];
  for (const choice of choices) {
    if (typeof choice !== "object" || choice === null) {
      continue;
    }

    const record = choice as Record<string, unknown>;
    if (typeof record.title !== "string") {
      continue;
    }

    const title = record.title.trim();
    if (title === "") {
      continue;
    }

    const item: AskUserToolChoice = { title };
    if (typeof record.description === "string") {
      const description = record.description.trim();
      if (description !== "") {
        item.description = description;
      }
    }
    normalized.push(item);
  }

  return normalized;
}

export function summarizeAskUserQuestion(toolCall: AiChatToolCall, fallbackIndex: number): string {
  const args = parseAskUserToolArguments(toolCall.argumentsText);
  const question = args?.question?.trim();
  if (!question) {
    return `问题 ${fallbackIndex + 1}`;
  }

  return question.length > 24 ? `${question.slice(0, 24)}…` : question;
}

export function listAwaitingUserInputToolCalls(snapshot: AiChatSnapshot): AiChatToolCall[] {
  if (snapshot.awaitingUserInputToolCallIds.length === 0) {
    return [];
  }

  const awaitingIds = new Set(snapshot.awaitingUserInputToolCallIds);
  const toolCalls: AiChatToolCall[] = [];

  for (const message of snapshot.messages) {
    if (message.role !== "assistant") {
      continue;
    }

    for (const toolCall of message.parts) {
      if (toolCall.type !== "tool_call") {
        continue;
      }

      if (awaitingIds.has(toolCall.id)) {
        toolCalls.push(toolCall);
      }
    }
  }

  return toolCalls.sort(
    (left, right) =>
      snapshot.awaitingUserInputToolCallIds.indexOf(left.id) -
      snapshot.awaitingUserInputToolCallIds.indexOf(right.id),
  );
}

export function findUserInputToolCall(
  snapshot: AiChatSnapshot,
  toolCallId: string,
): AiChatToolCall | null {
  for (const message of snapshot.messages) {
    if (message.role !== "assistant") {
      continue;
    }

    const toolCall =
      message.parts.find(
        (candidate): candidate is AiChatToolCall =>
          candidate.type === "tool_call" && candidate.id === toolCallId,
      ) ?? null;
    if (toolCall) {
      return toolCall;
    }
  }

  return null;
}

export function listUserInputToolCallsInActiveBatch(snapshot: AiChatSnapshot): AiChatToolCall[] {
  const awaitingIds = new Set(snapshot.awaitingUserInputToolCallIds);
  if (awaitingIds.size === 0) {
    return [];
  }

  for (const message of snapshot.messages) {
    if (
      message.role !== "assistant" ||
      !message.parts.some(
        (toolCall) => toolCall.type === "tool_call" && awaitingIds.has(toolCall.id),
      )
    ) {
      continue;
    }

    return message.parts.filter((toolCall): toolCall is AiChatToolCall => {
      return (
        toolCall.type === "tool_call" &&
        (toolCall.status === "awaiting_user" || toolCall.status === "complete")
      );
    });
  }

  return listAwaitingUserInputToolCalls(snapshot);
}
