import { useCallback } from "react";

import { useProjectContext } from "#workbench/state/molecules";

import { pickMockAiScenario } from "../quick-pick/mock-scenario-quick-pick";
import { useAiChatActions, useAiChatLoading, useAiChatPending } from "../state/use-ai-chat-state";

export function useAiChatSessionActions(onClearDraft: () => void) {
  const project = useProjectContext();
  const loading = useAiChatLoading();
  const pending = useAiChatPending();
  const { createConversation } = useAiChatActions();

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
    pending,
    handleCreateConversation,
    handleRunMockScenario,
  };
}
