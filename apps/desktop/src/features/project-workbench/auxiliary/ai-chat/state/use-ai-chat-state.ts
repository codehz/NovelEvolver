import { applyAiChatEvent, createInitialAiChatSnapshot } from "@novelevolver/domain/ai";
import type {
  AiChatInteractionAnswer,
  AiChatSelectableAgent,
  AiChatSelectableModel,
  AiChatSendMessageInput,
  AiChatSnapshot,
  AiConversationSearchHit,
  AiConversationSearchOptions,
} from "@novelevolver/domain/ai";
import type { AiReasoningLevel } from "@novelevolver/domain/settings/ai-settings";
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

import {
  useAiActiveChat,
  useAiCatalog,
  useAiConversations,
} from "#app/features/project-workbench/session/workspace-handles";
import { consumeRpcSubscription } from "#app/shared/lib/rpc/app-rpc-react";

import { stripHiddenAiChatWarningsFromSnapshot } from "../ui/ai-chat-helpers";
import { aiChatStateMolecule, initialAiChatTransportState } from "./ai-chat-state-molecule";

type AiChatActions = {
  sendMessage: (input: AiChatSendMessageInput) => Promise<boolean>;
  stopGeneration: () => Promise<void>;
  submitInteraction: (id: string, answer: AiChatInteractionAnswer) => Promise<void>;
  cancelInteraction: (id: string) => Promise<void>;
  retryLastRequest: () => Promise<void>;
  continueLastRequest: () => Promise<void>;
  selectMessageBranch: (messageId: string, index: number) => Promise<void>;
  editUserMessage: (messageId: string, input: AiChatSendMessageInput) => Promise<void>;
  createConversation: () => Promise<void>;
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
  const active = useAiActiveChat();
  const conversations = useAiConversations();
  const catalog = useAiCatalog();
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
        snapshot.openInteractions.length > 0
      ) {
        return false;
      }

      await Promise.resolve(
        active.sendMessage({
          text: input.text,
          slash: input.slash ?? null,
          mentions: input.mentions ?? [],
        }),
      );
      return true;
    },
    [active, snapshotAtom, store],
  );

  const stopGeneration = useCallback(async (): Promise<void> => {
    const snapshot = store.get(snapshotAtom);
    // pending 流式中，或 openInteractions 等待用户时均可中断。
    if (!snapshot.pending && snapshot.openInteractions.length === 0) {
      return;
    }
    await Promise.resolve(active.stopGeneration());
  }, [active, snapshotAtom, store]);

  const submitInteraction = useCallback(
    async (id: string, answer: AiChatInteractionAnswer): Promise<void> => {
      await Promise.resolve(active.submitInteraction(id, answer));
    },
    [active],
  );

  const cancelInteraction = useCallback(
    async (id: string): Promise<void> => {
      await Promise.resolve(active.cancelInteraction(id));
    },
    [active],
  );

  const createConversation = useCallback(async (): Promise<void> => {
    await Promise.resolve(conversations.create());
  }, [conversations]);

  const searchConversations = useCallback(
    async (
      query: string,
      options?: AiConversationSearchOptions,
    ): Promise<AiConversationSearchHit[]> => {
      return await Promise.resolve(conversations.search(query, options));
    },
    [conversations],
  );

  const switchConversation = useCallback(
    async (conversationId: string): Promise<void> => {
      await Promise.resolve(conversations.switch(conversationId));
    },
    [conversations],
  );

  const renameConversation = useCallback(
    async (conversationId: string, title: string): Promise<void> => {
      await Promise.resolve(conversations.rename(conversationId, title));
    },
    [conversations],
  );

  const archiveConversation = useCallback(
    async (conversationId: string): Promise<void> => {
      await Promise.resolve(conversations.archive(conversationId));
    },
    [conversations],
  );

  const unarchiveConversation = useCallback(
    async (conversationId: string): Promise<void> => {
      await Promise.resolve(conversations.unarchive(conversationId));
    },
    [conversations],
  );

  const deleteConversation = useCallback(
    async (conversationId: string): Promise<void> => {
      await Promise.resolve(conversations.delete(conversationId));
    },
    [conversations],
  );

  const listSelectableModels = useCallback(async (): Promise<AiChatSelectableModel[]> => {
    return await Promise.resolve(catalog.listModels());
  }, [catalog]);

  const setSelectedModel = useCallback(
    async (modelId: string): Promise<void> => {
      await Promise.resolve(active.setSelectedModel(modelId));
    },
    [active],
  );

  const listSelectableAgents = useCallback(async (): Promise<AiChatSelectableAgent[]> => {
    return await Promise.resolve(catalog.listAgents());
  }, [catalog]);

  const setSelectedAgent = useCallback(
    async (agentId: string): Promise<void> => {
      await Promise.resolve(active.setSelectedAgent(agentId));
    },
    [active],
  );

  const setSelectedReasoningLevel = useCallback(
    async (level: AiReasoningLevel | null): Promise<void> => {
      await Promise.resolve(active.setSelectedReasoningLevel(level));
    },
    [active],
  );

  const retryLastRequest = useCallback(async (): Promise<void> => {
    await Promise.resolve(active.retryLastRequest());
  }, [active]);

  const continueLastRequest = useCallback(async (): Promise<void> => {
    await Promise.resolve(active.continueLastRequest());
  }, [active]);

  const selectMessageBranch = useCallback(
    async (messageId: string, index: number): Promise<void> => {
      await Promise.resolve(active.selectMessageBranch(messageId, index));
    },
    [active],
  );

  const editUserMessage = useCallback(
    async (messageId: string, input: AiChatSendMessageInput): Promise<void> => {
      await Promise.resolve(active.editUserMessage(messageId, input));
    },
    [active],
  );

  return useMemo(
    () => ({
      sendMessage,
      stopGeneration,
      submitInteraction,
      cancelInteraction,
      retryLastRequest,
      continueLastRequest,
      selectMessageBranch,
      editUserMessage,
      createConversation,
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
      cancelInteraction,
      continueLastRequest,
      createConversation,
      deleteConversation,
      editUserMessage,
      listSelectableAgents,
      listSelectableModels,
      renameConversation,
      retryLastRequest,
      searchConversations,
      selectMessageBranch,
      sendMessage,
      setSelectedAgent,
      setSelectedModel,
      setSelectedReasoningLevel,
      stopGeneration,
      submitInteraction,
      switchConversation,
      unarchiveConversation,
    ],
  );
}

function AiChatFeedSync() {
  const active = useAiActiveChat();
  const { snapshotAtom, transportAtom } = useMolecule(aiChatStateMolecule);
  const setSnapshot = useSetAtom(snapshotAtom);
  const setTransport = useSetAtom(transportAtom);

  useEffect(() => {
    setSnapshot(createInitialAiChatSnapshot());
    setTransport(initialAiChatTransportState);

    return consumeRpcSubscription({
      subscribe: () => active.subscribe(),
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
  }, [active, setSnapshot, setTransport]);

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
    ...actions,
    snapshot,
    loading,
    subscriptionError,
  };
}
