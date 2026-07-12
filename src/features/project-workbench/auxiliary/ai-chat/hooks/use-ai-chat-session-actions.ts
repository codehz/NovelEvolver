import { useCallback } from "react";

import { useProjectContext } from "#workbench/state/molecules";

import { pickAiConversation } from "../quick-pick/ai-chat-history-quick-pick";
import { pickMockAiScenario } from "../quick-pick/mock-scenario-quick-pick";
import { useAiChatState } from "../state/use-ai-chat-state";

export function useAiChatSessionActions(onClearDraft: () => void) {
  const project = useProjectContext();
  const { snapshot, loading, createConversation, listConversations, switchConversation } =
    useAiChatState();

  const handleOpenHistory = useCallback(async () => {
    if (loading) {
      return;
    }

    const conversations = await listConversations();
    const selectedId = await pickAiConversation({
      conversations,
      activeConversationId: snapshot.conversationId,
    });
    if (selectedId === null || selectedId === snapshot.conversationId) {
      return;
    }

    onClearDraft();
    await switchConversation(selectedId);
  }, [listConversations, loading, onClearDraft, snapshot.conversationId, switchConversation]);

  const handleCreateConversation = useCallback(async () => {
    if (loading) {
      return;
    }

    onClearDraft();
    await createConversation();
  }, [createConversation, loading, onClearDraft]);

  const handleRunMockScenario = useCallback(async () => {
    if (loading) {
      return;
    }
    const control = await Promise.resolve(project.getMockAiControl());
    if (!control) {
      return;
    }
    const scenarios = await Promise.resolve(control.listScenarios());
    const scenarioId = await pickMockAiScenario(scenarios);
    if (!scenarioId) {
      return;
    }
    onClearDraft();
    await Promise.resolve(
      control.runScenario({ scenarioId, pacing: "preview", persistence: "persistent" }),
    );
  }, [loading, onClearDraft, project]);

  return {
    loading,
    pending: snapshot.pending,
    handleOpenHistory,
    handleCreateConversation,
    handleRunMockScenario,
  };
}
