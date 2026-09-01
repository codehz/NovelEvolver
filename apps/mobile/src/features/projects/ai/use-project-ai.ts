import {
  applyAiChatEvent,
  type AiChatEvent,
  type AiChatInteractionAnswer,
  type AiChatSelectableAgent,
  type AiChatSelectableModel,
  type AiChatSendMessageInput,
  type AiChatSnapshot,
  type AiConversationDirectorySnapshot,
  type AiConversationSearchHit,
  type AiConversationSummary,
} from "@novelevolver/domain/ai";
import type { AiReasoningLevel } from "@novelevolver/domain/settings/ai-settings";
import { useEffect, useRef, useState } from "react";

import type { OpenedProject } from "../git/repository-manager";

function eventTouchesWorktree(event: AiChatEvent): boolean {
  if (event.kind === "snapshot") {
    return true;
  }
  return event.ops.some((op) => {
    if (op.type === "assistant_part.updated") {
      return op.patch.status === "complete" || op.patch.status === "error";
    }
    if (op.type === "state.updated") {
      return op.patch.pending === false;
    }
    return false;
  });
}

export type ProjectAiModel = {
  snapshot: AiChatSnapshot;
  conversations: AiConversationSummary[];
  models: AiChatSelectableModel[];
  agents: AiChatSelectableAgent[];
  sendMessage: (input: AiChatSendMessageInput) => boolean;
  stopGeneration: () => void;
  submitInteraction: (id: string, answer: AiChatInteractionAnswer) => void;
  cancelInteraction: (id: string) => void;
  retryLastRequest: () => void;
  continueLastRequest: () => void;
  selectMessageBranch: (messageId: string, index: number) => void;
  editUserMessage: (messageId: string, input: AiChatSendMessageInput) => void;
  createConversation: () => void;
  switchConversation: (conversationId: string) => void;
  renameConversation: (conversationId: string, title: string) => void;
  archiveConversation: (conversationId: string) => void;
  unarchiveConversation: (conversationId: string) => void;
  deleteConversation: (conversationId: string) => void;
  searchConversations: (query: string, includeArchived?: boolean) => AiConversationSearchHit[];
  setSelectedModel: (modelId: string) => void;
  setSelectedAgent: (agentId: string) => void;
  setSelectedReasoningLevel: (level: AiReasoningLevel | null) => void;
  runScenario: (scenarioId: string) => void;
};

export function useProjectAi(opened: OpenedProject, onWorkspaceDirty: () => void): ProjectAiModel {
  const chat = opened.aiChat;
  const dirtyRef = useRef(onWorkspaceDirty);
  dirtyRef.current = onWorkspaceDirty;
  const [snapshot, setSnapshot] = useState<AiChatSnapshot>(() => chat.getSnapshot());
  const [directory, setDirectory] = useState<AiConversationDirectorySnapshot>(
    () => chat.getDirectory().snapshot,
  );
  const [catalogTick, setCatalogTick] = useState(0);

  useEffect(() => {
    setSnapshot(chat.getSnapshot());
    setDirectory(chat.getDirectory().snapshot);
    const stopChat = chat.addEventListener((event) => {
      setSnapshot((current) => applyAiChatEvent(current, event));
      if (eventTouchesWorktree(event)) {
        dirtyRef.current();
      }
    });
    const stopDirectory = chat.addDirectoryListener((event) => {
      setDirectory(event.snapshot);
    });
    return () => {
      stopChat();
      stopDirectory();
    };
  }, [chat]);

  void catalogTick;

  return {
    snapshot,
    conversations: directory.conversations,
    models: chat.listSelectableModels(),
    agents: chat.listSelectableAgents(),
    sendMessage: (input) => {
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
      chat.sendMessage({
        text: input.text,
        slash: input.slash ?? null,
        mentions: input.mentions ?? [],
      });
      return true;
    },
    stopGeneration: () => {
      chat.stopGeneration();
    },
    submitInteraction: (id, answer) => {
      chat.submitInteraction(id, answer);
    },
    cancelInteraction: (id) => {
      chat.cancelInteraction(id);
    },
    retryLastRequest: () => {
      chat.retryLastRequest();
    },
    continueLastRequest: () => {
      chat.continueLastRequest();
    },
    selectMessageBranch: (messageId, index) => {
      chat.selectMessageBranch(messageId, index);
    },
    editUserMessage: (messageId, input) => {
      chat.editUserMessage(messageId, input);
    },
    createConversation: () => {
      chat.createConversation();
    },
    switchConversation: (conversationId) => {
      chat.switchConversation(conversationId);
    },
    renameConversation: (conversationId, title) => {
      chat.renameConversation(conversationId, title);
    },
    archiveConversation: (conversationId) => {
      chat.archiveConversation(conversationId);
    },
    unarchiveConversation: (conversationId) => {
      chat.unarchiveConversation(conversationId);
    },
    deleteConversation: (conversationId) => {
      chat.deleteConversation(conversationId);
    },
    searchConversations: (query, includeArchived) =>
      chat.searchConversations(query, { includeArchived }),
    setSelectedModel: (modelId) => {
      chat.setSelectedModel(modelId);
      setCatalogTick((value) => value + 1);
    },
    setSelectedAgent: (agentId) => {
      chat.setSelectedAgent(agentId);
      setCatalogTick((value) => value + 1);
    },
    setSelectedReasoningLevel: (level) => {
      chat.setSelectedReasoningLevel(level);
    },
    runScenario: (scenarioId) => {
      chat.runScenario({ scenarioId, pacing: "preview", persistence: "persistent" });
    },
  };
}
