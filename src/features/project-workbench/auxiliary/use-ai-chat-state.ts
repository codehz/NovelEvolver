import { useCallback, useEffect, useState } from "react";

import { consumeRpcSubscription } from "#app/shared/lib/rpc/app-rpc-react";
import type {
  AiChatEvent,
  AiChatMessage,
  AiChatReasoning,
  AiChatSnapshot,
} from "#shared/rpc/ai-rpc";

import { useAiChat } from "../branch/branch-scopes";

function createInitialAiChatSnapshot(): AiChatSnapshot {
  return {
    adapterKind: "mock",
    model: "mock-assistant",
    messages: [],
    pending: false,
    errorMessage: null,
  };
}

function applyMessagePatch(
  message: AiChatMessage,
  patch: {
    text?: string;
    status?: AiChatMessage["status"];
    usage?: AiChatMessage["usage"];
    reasoning?: {
      text?: string;
      visibility?: AiChatReasoning["visibility"];
      status?: AiChatReasoning["status"];
    } | null;
  },
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

function applyAiChatEvent(snapshot: AiChatSnapshot, event: AiChatEvent): AiChatSnapshot {
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
            message.id === op.messageId ? applyMessagePatch(message, op.patch) : message,
          ),
        };
        break;
      case "message.removed":
        next = {
          ...next,
          messages: next.messages.filter((message) => message.id !== op.messageId),
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

export function useAiChatState() {
  const aiChat = useAiChat();
  const [snapshot, setSnapshot] = useState<AiChatSnapshot>(() => createInitialAiChatSnapshot());
  const [loading, setLoading] = useState(true);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);

  useEffect(() => {
    setSnapshot(createInitialAiChatSnapshot());
    setLoading(true);
    setSubscriptionError(null);

    return consumeRpcSubscription({
      subscribe: () => aiChat.subscribeChat(),
      onValue: (event) => {
        setSnapshot((current) => applyAiChatEvent(current, event));
        setLoading(false);
        setSubscriptionError(null);
      },
      onError: (error) => {
        setLoading(false);
        setSubscriptionError(error instanceof Error ? error.message : String(error));
      },
      cancelReason: "AI chat subscription disposed.",
    });
  }, [aiChat]);

  const sendMessage = useCallback(
    async (text: string): Promise<boolean> => {
      const normalized = text.trim();
      if (normalized === "" || snapshot.pending) {
        return false;
      }

      await Promise.resolve(aiChat.sendMessage(normalized));
      return true;
    },
    [aiChat, snapshot.pending],
  );

  const resetConversation = useCallback(async (): Promise<void> => {
    await Promise.resolve(aiChat.resetConversation());
  }, [aiChat]);

  return {
    snapshot,
    loading,
    subscriptionError,
    sendMessage,
    resetConversation,
  };
}
