import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

import { consumeRpcSubscription } from "#app/shared/lib/rpc/app-rpc-react";
import { applyAiChatEvent, createInitialAiChatSnapshot } from "#shared/rpc/ai/index";
import type {
  AiChatSelectableAgent,
  AiChatSelectableModel,
  AiChatSendMessageInput,
  AiChatSnapshot,
  AiConversationListOptions,
  AiConversationSearchHit,
  AiConversationSearchOptions,
  AiConversationSummary,
} from "#shared/rpc/ai/index";
import type { AiReasoningLevel } from "#shared/rpc/services/index";
import { useAiChat } from "#workbench/branch/branch-scopes";

import { stripHiddenAiChatWarningsFromSnapshot } from "../ui/ai-chat-helpers";
import { aiChatStateMolecule, initialAiChatTransportState } from "./ai-chat-state-molecule";

type AiChatActions = {
  sendMessage: (input: AiChatSendMessageInput) => Promise<boolean>;
  stopGeneration: () => Promise<void>;
  retryLastRequest: () => Promise<void>;
  createConversation: () => Promise<void>;
  listConversations: (options?: AiConversationListOptions) => Promise<AiConversationSummary[]>;
  searchConversations: (
    query: string,
    options?: AiConversationSearchOptions,
  ) => Promise<AiConversationSearchHit[]>;
  switchConversation: (conversationId: string) => Promise<void>;
  renameConversation: (conversationId: string, title: string) => Promise<void>;
  archiveConversation: (conversationId: string) => Promise<void>;
  unarchiveConversation: (conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  listSelectableModels: () => Promise<AiChatSelectableModel[]>;
  setSelectedModel: (modelId: string) => Promise<void>;
  listSelectableAgents: () => Promise<AiChatSelectableAgent[]>;
  setSelectedAgent: (agentId: string) => Promise<void>;
  setSelectedReasoningLevel: (level: AiReasoningLevel | null) => Promise<void>;
};

const AiChatActionsContext = createContext<AiChatActions | null>(null);

function useAiChatActionsValue(): AiChatActions {
  const aiChat = useAiChat();
  const store = useStore();
  const { snapshotAtom } = useMolecule(aiChatStateMolecule);

  const sendMessage = useCallback(
    async (input: AiChatSendMessageInput): Promise<boolean> => {
      const snapshot = store.get(snapshotAtom);
      const hasSlash = input.slash != null;
      const hasMentions = (input.mentions?.length ?? 0) > 0;
      const normalizedText = input.text.trim();
      if (
        (!hasSlash && !hasMentions && normalizedText === "") ||
        snapshot.pending ||
        snapshot.pendingUserInputs.length > 0
      ) {
        return false;
      }

      await Promise.resolve(
        aiChat.sendMessage({
          text: input.text,
          slash: input.slash ?? null,
          mentions: input.mentions ?? [],
        }),
      );
      return true;
    },
    [aiChat, snapshotAtom, store],
  );

  const stopGeneration = useCallback(async (): Promise<void> => {
    const snapshot = store.get(snapshotAtom);
    if (!snapshot.pending) {
      return;
    }
    await Promise.resolve(aiChat.stopGeneration());
  }, [aiChat, snapshotAtom, store]);

  const createConversation = useCallback(async (): Promise<void> => {
    await Promise.resolve(aiChat.createConversation());
  }, [aiChat]);

  const listConversations = useCallback(
    async (options?: AiConversationListOptions): Promise<AiConversationSummary[]> => {
      return await Promise.resolve(aiChat.listConversations(options));
    },
    [aiChat],
  );

  const searchConversations = useCallback(
    async (
      query: string,
      options?: AiConversationSearchOptions,
    ): Promise<AiConversationSearchHit[]> => {
      return await Promise.resolve(aiChat.searchConversations(query, options));
    },
    [aiChat],
  );

  const switchConversation = useCallback(
    async (conversationId: string): Promise<void> => {
      await Promise.resolve(aiChat.switchConversation(conversationId));
    },
    [aiChat],
  );

  const renameConversation = useCallback(
    async (conversationId: string, title: string): Promise<void> => {
      await Promise.resolve(aiChat.renameConversation(conversationId, title));
    },
    [aiChat],
  );

  const archiveConversation = useCallback(
    async (conversationId: string): Promise<void> => {
      await Promise.resolve(aiChat.archiveConversation(conversationId));
    },
    [aiChat],
  );

  const unarchiveConversation = useCallback(
    async (conversationId: string): Promise<void> => {
      await Promise.resolve(aiChat.unarchiveConversation(conversationId));
    },
    [aiChat],
  );

  const deleteConversation = useCallback(
    async (conversationId: string): Promise<void> => {
      await Promise.resolve(aiChat.deleteConversation(conversationId));
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

  const setSelectedReasoningLevel = useCallback(
    async (level: AiReasoningLevel | null): Promise<void> => {
      await Promise.resolve(aiChat.setSelectedReasoningLevel(level));
    },
    [aiChat],
  );

  const retryLastRequest = useCallback(async (): Promise<void> => {
    await Promise.resolve(aiChat.retryLastRequest());
  }, [aiChat]);

  return useMemo(
    () => ({
      sendMessage,
      stopGeneration,
      retryLastRequest,
      createConversation,
      listConversations,
      searchConversations,
      switchConversation,
      renameConversation,
      archiveConversation,
      unarchiveConversation,
      deleteConversation,
      listSelectableModels,
      setSelectedModel,
      listSelectableAgents,
      setSelectedAgent,
      setSelectedReasoningLevel,
    }),
    [
      archiveConversation,
      createConversation,
      deleteConversation,
      listConversations,
      listSelectableAgents,
      listSelectableModels,
      renameConversation,
      retryLastRequest,
      searchConversations,
      sendMessage,
      setSelectedAgent,
      setSelectedModel,
      setSelectedReasoningLevel,
      stopGeneration,
      switchConversation,
      unarchiveConversation,
    ],
  );
}

function AiChatFeedSync() {
  const aiChat = useAiChat();
  const { snapshotAtom, transportAtom } = useMolecule(aiChatStateMolecule);
  const setSnapshot = useSetAtom(snapshotAtom);
  const setTransport = useSetAtom(transportAtom);

  useEffect(() => {
    setSnapshot(createInitialAiChatSnapshot());
    setTransport(initialAiChatTransportState);

    return consumeRpcSubscription({
      subscribe: () => aiChat.subscribeChat(),
      onValue: (event) => {
        setSnapshot((current) =>
          stripHiddenAiChatWarningsFromSnapshot(applyAiChatEvent(current, event)),
        );
        setTransport({ loading: false, subscriptionError: null });
      },
      onError: (error) => {
        setTransport({
          loading: false,
          subscriptionError: error instanceof Error ? error.message : String(error),
        });
      },
      cancelReason: "AI chat subscription disposed.",
    });
  }, [aiChat, setSnapshot, setTransport]);

  return null;
}

export function AiChatStateProvider({ children }: { children: ReactNode }) {
  const actions = useAiChatActionsValue();
  return createElement(
    AiChatActionsContext.Provider,
    { value: actions },
    createElement(AiChatFeedSync),
    children,
  );
}

export function useAiChatActions(): AiChatActions {
  const value = useContext(AiChatActionsContext);
  if (!value) {
    throw new Error("useAiChatActions must be used within AiChatStateProvider.");
  }
  return value;
}

export function useAiChatSnapshot(): AiChatSnapshot {
  const { snapshotAtom } = useMolecule(aiChatStateMolecule);
  return useAtomValue(snapshotAtom);
}

export function useAiChatLoading(): boolean {
  const { loadingAtom } = useMolecule(aiChatStateMolecule);
  return useAtomValue(loadingAtom);
}

export function useAiChatSubscriptionError(): string | null {
  const { subscriptionErrorAtom } = useMolecule(aiChatStateMolecule);
  return useAtomValue(subscriptionErrorAtom);
}

export function useAiChatMessages() {
  const { messagesAtom } = useMolecule(aiChatStateMolecule);
  return useAtomValue(messagesAtom);
}

export function useAiChatPending(): boolean {
  const { pendingAtom } = useMolecule(aiChatStateMolecule);
  return useAtomValue(pendingAtom);
}

export function useAiChatConversationId(): string {
  const { conversationIdAtom } = useMolecule(aiChatStateMolecule);
  return useAtomValue(conversationIdAtom);
}

export function useAiChatStatusMeta() {
  const { statusMetaAtom } = useMolecule(aiChatStateMolecule);
  return useAtomValue(statusMetaAtom);
}

/** 兼容聚合 API：同时订阅 snapshot + transport + actions。优先改用细粒度 hooks。 */
export function useAiChatState() {
  const actions = useAiChatActions();
  const snapshot = useAiChatSnapshot();
  const loading = useAiChatLoading();
  const subscriptionError = useAiChatSubscriptionError();
  return {
    snapshot,
    loading,
    subscriptionError,
    ...actions,
  };
}
