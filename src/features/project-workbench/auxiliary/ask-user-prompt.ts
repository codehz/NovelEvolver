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

export function findAwaitingAskUserToolCall(snapshot: AiChatSnapshot): AiChatToolCall | null {
  if (snapshot.awaitingToolCallId === null) {
    return null;
  }

  for (const message of snapshot.messages) {
    const toolCall = message.toolCalls.find(
      (candidate) => candidate.id === snapshot.awaitingToolCallId && candidate.name === "ask_user",
    );
    if (toolCall) {
      return toolCall;
    }
  }

  return null;
}
