import { useCallback, useEffect, useMemo, useState } from "react";

import type { AiChatSelectableAgent, AiChatSelectableModel } from "#shared/rpc/ai/index";

import { pickAiChatAgent } from "../quick-pick/agent-selector-quick-pick";
import { pickAiChatModel } from "../quick-pick/model-selector-quick-pick";
import { useAiChatState } from "../state/use-ai-chat-state";

export function useAiChatSelectors() {
  const {
    snapshot,
    loading,
    listSelectableModels,
    setSelectedModel,
    listSelectableAgents,
    setSelectedAgent,
  } = useAiChatState();

  const [selectableModels, setSelectableModels] = useState<AiChatSelectableModel[]>([]);
  const [selectableAgents, setSelectableAgents] = useState<AiChatSelectableAgent[]>([]);

  const hasPendingUserInputs = snapshot.pendingUserInputs.length > 0;

  useEffect(() => {
    let active = true;
    void listSelectableModels().then((models) => {
      if (active) {
        setSelectableModels(models);
      }
    });
    return () => {
      active = false;
    };
  }, [listSelectableModels, snapshot.selectedModelId]);

  useEffect(() => {
    let active = true;
    void listSelectableAgents().then((agents) => {
      if (active) {
        setSelectableAgents(agents);
      }
    });
    return () => {
      active = false;
    };
  }, [listSelectableAgents, snapshot.selectedAgentId]);

  const selectedModel =
    selectableModels.find((model) => model.id === snapshot.selectedModelId) ?? null;
  const selectedModelLabel = selectedModel?.name
    ? selectedModel.name
    : snapshot.selectedModelId
      ? "未知模型"
      : "选择模型";

  const selectedAgent =
    selectableAgents.find((agent) => agent.id === snapshot.selectedAgentId) ??
    selectableAgents.find((agent) => agent.builtin) ??
    null;
  const selectedAgentLabel = selectedAgent?.name ?? "选择 Agent";

  const handlePickModel = useCallback(async () => {
    if (loading || snapshot.pending) {
      return;
    }
    const models = await listSelectableModels();
    setSelectableModels(models);
    const selectedId = await pickAiChatModel(models, snapshot.selectedModelId);
    if (!selectedId || selectedId === snapshot.selectedModelId) {
      return;
    }
    await setSelectedModel(selectedId);
  }, [listSelectableModels, loading, setSelectedModel, snapshot.pending, snapshot.selectedModelId]);

  const handlePickAgent = useCallback(async () => {
    if (loading || snapshot.pending || hasPendingUserInputs) {
      return;
    }
    const [agents, models] = await Promise.all([listSelectableAgents(), listSelectableModels()]);
    setSelectableAgents(agents);
    setSelectableModels(models);
    const selectedId = await pickAiChatAgent(agents, models, snapshot.selectedAgentId);
    if (!selectedId || selectedId === snapshot.selectedAgentId) {
      return;
    }
    await setSelectedAgent(selectedId);
  }, [
    hasPendingUserInputs,
    listSelectableAgents,
    listSelectableModels,
    loading,
    setSelectedAgent,
    snapshot.pending,
    snapshot.selectedAgentId,
  ]);

  const selectorDisabled = useMemo(
    () => loading || snapshot.pending || hasPendingUserInputs,
    [hasPendingUserInputs, loading, snapshot.pending],
  );

  return {
    selectedModelLabel,
    selectedAgentLabel,
    selectorDisabled,
    composerDisabled: loading || snapshot.pending,
    handlePickModel,
    handlePickAgent,
  };
}
