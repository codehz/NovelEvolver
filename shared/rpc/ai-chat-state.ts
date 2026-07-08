import type {
  AiChatEvent,
  AiChatMessage,
  AiChatMessagePatch,
  AiChatSnapshot,
  AiChatToolCall,
  AiChatToolCallPatch,
} from "./ai-rpc";

export function createInitialAiChatSnapshot(model = "mock-assistant"): AiChatSnapshot {
  return {
    adapterKind: "mock",
    model,
    messages: [],
    pending: false,
    errorMessage: null,
  };
}

export function cloneAiChatToolCall(toolCall: AiChatToolCall): AiChatToolCall {
  return { ...toolCall };
}

export function cloneAiChatToolCallPatch(patch: AiChatToolCallPatch): AiChatToolCallPatch {
  return { ...patch };
}

export function cloneAiChatMessage(message: AiChatMessage): AiChatMessage {
  return {
    ...message,
    usage: message.usage ? { ...message.usage } : null,
    reasoning: message.reasoning ? { ...message.reasoning } : null,
    toolCalls: message.toolCalls.map(cloneAiChatToolCall),
  };
}

export function cloneAiChatMessagePatch(patch: AiChatMessagePatch): AiChatMessagePatch {
  return {
    ...patch,
    usage: patch.usage ? { ...patch.usage } : patch.usage,
    reasoning:
      patch.reasoning === undefined
        ? undefined
        : patch.reasoning === null
          ? null
          : { ...patch.reasoning },
  };
}

export function applyAiChatMessagePatch(
  message: AiChatMessage,
  patch: AiChatMessagePatch,
): AiChatMessage {
  return {
    ...message,
    ...patch,
    usage: patch.usage !== undefined ? patch.usage : message.usage,
    reasoning:
      patch.reasoning === undefined
        ? message.reasoning
        : patch.reasoning === null
          ? null
          : {
              text: message.reasoning?.text ?? "",
              visibility: patch.reasoning.visibility ?? message.reasoning?.visibility ?? "summary",
              status: patch.reasoning.status ?? message.reasoning?.status ?? "streaming",
              ...patch.reasoning,
            },
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
          messages: [],
          pending: false,
          errorMessage: null,
        };
        break;
      case "message.added":
        next = {
          ...next,
          messages: [...next.messages, op.message],
        };
        break;
      case "message.text.delta":
        next = {
          ...next,
          messages: next.messages.map((message) =>
            message.id === op.messageId
              ? {
                  ...message,
                  text: `${message.text}${op.text}`,
                }
              : message,
          ),
        };
        break;
      case "message.reasoning.delta":
        next = {
          ...next,
          messages: next.messages.map((message) =>
            message.id === op.messageId
              ? {
                  ...message,
                  reasoning: {
                    text: `${message.reasoning?.text ?? ""}${op.text}`,
                    visibility: message.reasoning?.visibility ?? "summary",
                    status: message.reasoning?.status ?? "streaming",
                  },
                }
              : message,
          ),
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
      case "tool_call.added":
        next = {
          ...next,
          messages: next.messages.map((message) =>
            message.id === op.messageId
              ? {
                  ...message,
                  toolCalls: [...message.toolCalls, cloneAiChatToolCall(op.toolCall)],
                }
              : message,
          ),
        };
        break;
      case "tool_call.updated":
        next = {
          ...next,
          messages: next.messages.map((message) =>
            message.id === op.messageId
              ? {
                  ...message,
                  toolCalls: message.toolCalls.map((toolCall) =>
                    toolCall.id === op.toolCallId
                      ? {
                          ...toolCall,
                          ...op.patch,
                        }
                      : toolCall,
                  ),
                }
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
