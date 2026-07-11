import type {
  AiChatAssistantMessage,
  AiChatAssistantPart,
  AiChatAssistantPartPatch,
  AiChatEvent,
  AiChatMessage,
  AiChatMessagePatch,
  AiChatSnapshot,
} from "./ai-rpc";

export function createInitialAiChatSnapshot(model = "mock-assistant"): AiChatSnapshot {
  return {
    conversationId: "",
    adapterKind: "mock",
    model,
    messages: [],
    pending: false,
    pendingUserInputs: [],
    errorMessage: null,
  };
}

export function cloneAiChatAssistantPart(part: AiChatAssistantPart): AiChatAssistantPart {
  return { ...part };
}

export function cloneAiChatAssistantPartPatch(
  patch: AiChatAssistantPartPatch,
): AiChatAssistantPartPatch {
  return { ...patch };
}

export function cloneAiChatMessage(message: AiChatMessage): AiChatMessage {
  if (message.role === "user") {
    return { ...message };
  }

  return {
    ...message,
    usage: message.usage ? { ...message.usage } : null,
    parts: message.parts.map(cloneAiChatAssistantPart),
  };
}

export function cloneAiChatMessagePatch(patch: AiChatMessagePatch): AiChatMessagePatch {
  return {
    ...patch,
    usage: patch.usage ? { ...patch.usage } : patch.usage,
  };
}

export function applyAiChatMessagePatch(
  message: AiChatMessage,
  patch: AiChatMessagePatch,
): AiChatMessage {
  if (message.role === "user") {
    return message;
  }

  return {
    ...message,
    status: patch.status ?? message.status,
    usage: patch.usage !== undefined ? patch.usage : message.usage,
  };
}

export function applyAiChatAssistantPartPatch(
  part: AiChatAssistantPart,
  patch: AiChatAssistantPartPatch,
): AiChatAssistantPart {
  switch (part.type) {
    case "message":
      return {
        ...part,
        text: patch.text ?? part.text,
        status:
          typeof patch.status === "string" &&
          patch.status !== "pending" &&
          patch.status !== "running" &&
          patch.status !== "awaiting_user" &&
          patch.status !== "error"
            ? patch.status
            : part.status,
      };
    case "reasoning":
      return {
        ...part,
        text: patch.text ?? part.text,
        visibility: patch.visibility ?? part.visibility,
        status:
          typeof patch.status === "string" &&
          patch.status !== "pending" &&
          patch.status !== "running" &&
          patch.status !== "awaiting_user" &&
          patch.status !== "error"
            ? patch.status
            : part.status,
      };
    case "tool_call":
      return {
        ...part,
        argumentsText: patch.argumentsText ?? part.argumentsText,
        status:
          patch.status === "pending" ||
          patch.status === "running" ||
          patch.status === "awaiting_user" ||
          patch.status === "complete" ||
          patch.status === "error"
            ? patch.status
            : part.status,
        resultText: patch.resultText !== undefined ? patch.resultText : part.resultText,
        errorMessage: patch.errorMessage !== undefined ? patch.errorMessage : part.errorMessage,
      };
  }
}

function applyAssistantPartTextDelta(part: AiChatAssistantPart, text: string): AiChatAssistantPart {
  if (part.type === "tool_call") {
    return part;
  }

  return {
    ...part,
    text: `${part.text}${text}`,
  };
}

function applyAssistantPartUpdate(
  message: AiChatAssistantMessage,
  partId: string,
  updater: (part: AiChatAssistantPart) => AiChatAssistantPart,
): AiChatAssistantMessage {
  return {
    ...message,
    parts: message.parts.map((part) => (part.id === partId ? updater(part) : part)),
  };
}

export function applyAiChatEvent(snapshot: AiChatSnapshot, event: AiChatEvent): AiChatSnapshot {
  if (event.kind === "snapshot") {
    return event.snapshot;
  }

  let next = snapshot;
  for (const op of event.ops) {
    switch (op.type) {
      case "conversation.reset":
        next = {
          ...next,
          conversationId: "",
          messages: [],
          pending: false,
          pendingUserInputs: [],
          errorMessage: null,
        };
        break;
      case "message.added":
        next = {
          ...next,
          messages: [...next.messages, cloneAiChatMessage(op.message)],
        };
        break;
      case "message.updated":
        next = {
          ...next,
          messages: next.messages.map((message) =>
            message.id === op.messageId ? applyAiChatMessagePatch(message, op.patch) : message,
          ),
        };
        break;
      case "message.removed":
        next = {
          ...next,
          messages: next.messages.filter((message) => message.id !== op.messageId),
        };
        break;
      case "assistant_part.added":
        next = {
          ...next,
          messages: next.messages.map((message) =>
            message.id === op.messageId && message.role === "assistant"
              ? {
                  ...message,
                  parts: [...message.parts, cloneAiChatAssistantPart(op.part)],
                }
              : message,
          ),
        };
        break;
      case "assistant_part.text.delta":
        next = {
          ...next,
          messages: next.messages.map((message) =>
            message.id === op.messageId && message.role === "assistant"
              ? applyAssistantPartUpdate(message, op.partId, (part) =>
                  applyAssistantPartTextDelta(part, op.text),
                )
              : message,
          ),
        };
        break;
      case "assistant_part.updated":
        next = {
          ...next,
          messages: next.messages.map((message) =>
            message.id === op.messageId && message.role === "assistant"
              ? applyAssistantPartUpdate(message, op.partId, (part) =>
                  applyAiChatAssistantPartPatch(part, op.patch),
                )
              : message,
          ),
        };
        break;
      case "state.updated":
        next = {
          ...next,
          ...op.patch,
        };
        break;
    }
  }

  return next;
}
