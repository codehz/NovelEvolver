import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { consumeRpcSubscription } from "#app/shared/lib/rpc/app-rpc-react";
import { applyAiChatEvent, createInitialAiChatSnapshot } from "#shared/rpc/ai/index";
import type {
  AiChatSelectableAgent,
  AiChatSelectableModel,
  AiChatSnapshot,
  AiConversationSummary,
} from "#shared/rpc/ai/index";
import { useAiChat } from "#workbench/branch/branch-scopes";

import { stripHiddenAiChatWarningsFromSnapshot } from "../ui/ai-chat-ui";

function useAiChatStateValue() {
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
        setSnapshot((current) =>
          stripHiddenAiChatWarningsFromSnapshot(applyAiChatEvent(current, event)),
        );
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

  const stopGeneration = useCallback(async (): Promise<void> => {
    if (!snapshot.pending) {
      return;
    }
    await Promise.resolve(aiChat.stopGeneration());
  }, [aiChat, snapshot.pending]);

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

  const listSelectableModels = useCallback(async (): Promise<AiChatSelectableModel[]> => {
    return await Promise.resolve(aiChat.listSelectableModels());
  }, [aiChat]);

  const setSelectedModel = useCallback(
    async (modelId: string): Promise<void> => {
      await Promise.resolve(aiChat.setSelectedModel(modelId));
    },
    [aiChat],
  );

  const listSelectableAgents = useCallback(async (): Promise<AiChatSelectableAgent[]> => {
    return await Promise.resolve(aiChat.listSelectableAgents());
  }, [aiChat]);

  const setSelectedAgent = useCallback(
    async (agentId: string): Promise<void> => {
      await Promise.resolve(aiChat.setSelectedAgent(agentId));
    },
    [aiChat],
  );

  const retryLastRequest = useCallback(async (): Promise<void> => {
    await Promise.resolve(aiChat.retryLastRequest());
  }, [aiChat]);

  return {
    snapshot,
    loading,
    subscriptionError,
    sendMessage,
    stopGeneration,
    retryLastRequest,
    createConversation,
    listConversations,
    switchConversation,
    listSelectableModels,
    setSelectedModel,
    listSelectableAgents,
    setSelectedAgent,
  };
}

type AiChatStateValue = ReturnType<typeof useAiChatStateValue>;

const AiChatStateContext = createContext<AiChatStateValue | null>(null);

export function AiChatStateProvider({ children }: { children: ReactNode }) {
  const value = useAiChatStateValue();
  return createElement(AiChatStateContext, { value }, children);
}

export function useAiChatState(): AiChatStateValue {
  const value = useContext(AiChatStateContext);
  if (!value) {
    throw new Error("useAiChatState must be used within AiChatStateProvider.");
  }
  return value;
}
