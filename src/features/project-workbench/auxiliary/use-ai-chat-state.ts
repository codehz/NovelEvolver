import { useCallback, useEffect, useState } from "react";

import { consumeRpcSubscription } from "#app/shared/lib/rpc/app-rpc-react";
import { applyAiChatEvent, createInitialAiChatSnapshot } from "#shared/rpc/ai-chat-state";
import type { AiChatSnapshot } from "#shared/rpc/ai-rpc";

import { useAiChat } from "../branch/branch-scopes";

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
      if (normalized === "" || snapshot.pending || snapshot.awaitingToolCallId !== null) {
        return false;
      }

      await Promise.resolve(aiChat.sendMessage(normalized));
      return true;
    },
    [aiChat, snapshot.awaitingToolCallId, snapshot.pending],
  );

  const submitToolResponse = useCallback(
    async (toolCallId: string, text: string): Promise<boolean> => {
      const normalized = text.trim();
      if (
        normalized === "" ||
        snapshot.pending ||
        snapshot.awaitingToolCallId === null ||
        snapshot.awaitingToolCallId !== toolCallId
      ) {
        return false;
      }

      await Promise.resolve(aiChat.submitToolResponse(toolCallId, normalized));
      return true;
    },
    [aiChat, snapshot.awaitingToolCallId, snapshot.pending],
  );

  const resetConversation = useCallback(async (): Promise<void> => {
    await Promise.resolve(aiChat.resetConversation());
  }, [aiChat]);

  return {
    snapshot,
    loading,
    subscriptionError,
    sendMessage,
    submitToolResponse,
    resetConversation,
  };
}
