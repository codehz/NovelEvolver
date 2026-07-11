import { useCallback, useEffect, useState } from "react";

import { consumeRpcSubscription } from "#app/shared/lib/rpc/app-rpc-react";
import { applyAiChatEvent, createInitialAiChatSnapshot } from "#shared/rpc/ai-chat-state";
import type { AiChatSnapshot, AiConversationSummary } from "#shared/rpc/ai-rpc";

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
      if (normalized === "" || snapshot.pending || snapshot.pendingUserInputs.length > 0) {
        return false;
      }

      await Promise.resolve(aiChat.sendMessage(normalized));
      return true;
    },
    [aiChat, snapshot.pendingUserInputs, snapshot.pending],
  );

  const createConversation = useCallback(async (): Promise<void> => {
    await Promise.resolve(aiChat.createConversation());
  }, [aiChat]);

  const listConversations = useCallback(async (): Promise<AiConversationSummary[]> => {
    return await Promise.resolve(aiChat.listConversations());
  }, [aiChat]);

  const switchConversation = useCallback(
    async (conversationId: string): Promise<void> => {
      await Promise.resolve(aiChat.switchConversation(conversationId));
    },
    [aiChat],
  );

  return {
    snapshot,
    loading,
    subscriptionError,
    sendMessage,
    createConversation,
    listConversations,
    switchConversation,
  };
}
