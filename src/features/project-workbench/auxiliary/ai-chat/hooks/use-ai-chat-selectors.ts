import { useCallback, useEffect, useMemo, useState } from "react";

import type { AiChatSelectableAgent, AiChatSelectableModel } from "#shared/rpc/ai/index";

import { toAgentSelectorItems, toModelSelectorItems, type AiChatSelectorItem } from "../selectors";
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

  const refreshModels = useCallback(async () => {
    const models = await listSelectableModels();
    setSelectableModels(models);
    return models;
  }, [listSelectableModels]);

  const refreshAgents = useCallback(async () => {
    const agents = await listSelectableAgents();
    setSelectableAgents(agents);
    return agents;
  }, [listSelectableAgents]);

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

  const modelItems: AiChatSelectorItem[] = useMemo(
    () => toModelSelectorItems(selectableModels, snapshot.selectedModelId),
    [selectableModels, snapshot.selectedModelId],
  );

  const agentItems: AiChatSelectorItem[] = useMemo(
    () => toAgentSelectorItems(selectableAgents, selectableModels, snapshot.selectedAgentId),
    [selectableAgents, selectableModels, snapshot.selectedAgentId],
  );

  const handleOpenModelPicker = useCallback(() => {
    void refreshModels();
  }, [refreshModels]);

  const handleOpenAgentPicker = useCallback(() => {
    void Promise.all([refreshAgents(), refreshModels()]);
  }, [refreshAgents, refreshModels]);

  const handleSelectModel = useCallback(
    (modelId: string) => {
      if (loading || snapshot.pending || modelId === snapshot.selectedModelId) {
        return;
      }
      void setSelectedModel(modelId);
    },
    [loading, setSelectedModel, snapshot.pending, snapshot.selectedModelId],
  );

  const handleSelectAgent = useCallback(
    (agentId: string) => {
      if (loading || snapshot.pending || hasPendingUserInputs) {
        return;
      }
      if (agentId === snapshot.selectedAgentId) {
        return;
      }
      void setSelectedAgent(agentId);
    },
    [hasPendingUserInputs, loading, setSelectedAgent, snapshot.pending, snapshot.selectedAgentId],
  );

  const selectorDisabled = useMemo(
    () => loading || snapshot.pending || hasPendingUserInputs,
    [hasPendingUserInputs, loading, snapshot.pending],
  );

  const modelSelectorDisabled = useMemo(
    () => loading || snapshot.pending,
    [loading, snapshot.pending],
  );

  return {
    selectedModelLabel,
    selectedAgentLabel,
    agentItems,
    modelItems,
    selectorDisabled,
    modelSelectorDisabled,
    composerDisabled: loading || snapshot.pending,
    handleOpenAgentPicker,
    handleOpenModelPicker,
    handleSelectModel,
    handleSelectAgent,
  };
}
