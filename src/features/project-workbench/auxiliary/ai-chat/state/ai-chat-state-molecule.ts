import { molecule, use } from "bunshi/react";
import { atom } from "jotai";

import { createInitialAiChatSnapshot } from "#shared/rpc/ai/index";
import type { AiChatMessage, AiChatSnapshot } from "#shared/rpc/ai/index";
import { projectIdScope } from "#workbench/session/project-scope";

export type AiChatTransportState = {
  loading: boolean;
  subscriptionError: string | null;
};

export const initialAiChatTransportState: AiChatTransportState = {
  loading: true,
  subscriptionError: null,
};

/**
 * 项目级 AI chat 状态切片。
 * RPC 订阅由 `AiChatStateProvider` 写入；UI 按需订阅派生 atom，避免 stream 时整树重渲。
 */
export const aiChatStateMolecule = molecule(() => {
  use(projectIdScope);

  const snapshotAtom = atom<AiChatSnapshot>(createInitialAiChatSnapshot());
  const transportAtom = atom<AiChatTransportState>(initialAiChatTransportState);

  const messagesAtom = atom((get) => get(snapshotAtom).messages);
  const pendingAtom = atom((get) => get(snapshotAtom).pending);
  const pendingUserInputsAtom = atom((get) => get(snapshotAtom).pendingUserInputs);
  const conversationIdAtom = atom((get) => get(snapshotAtom).conversationId);
  const canRetryAtom = atom((get) => get(snapshotAtom).canRetry);
  const errorMessageAtom = atom((get) => get(snapshotAtom).errorMessage);
  const warningsAtom = atom((get) => get(snapshotAtom).warnings);
  const scenarioIdAtom = atom((get) => get(snapshotAtom).scenarioId);
  const selectedModelIdAtom = atom((get) => get(snapshotAtom).selectedModelId);
  const selectedAgentIdAtom = atom((get) => get(snapshotAtom).selectedAgentId);
  const selectedReasoningLevelAtom = atom((get) => get(snapshotAtom).selectedReasoningLevel);
  const modelAtom = atom((get) => get(snapshotAtom).model);
  const loadingAtom = atom((get) => get(transportAtom).loading);
  const subscriptionErrorAtom = atom((get) => get(transportAtom).subscriptionError);

  /** 状态栏等轻量消费者：不依赖完整 messages 数组引用的元信息。 */
  const statusMetaAtom = atom((get) => {
    const snapshot = get(snapshotAtom);
    const transport = get(transportAtom);
    return {
      loading: transport.loading,
      subscriptionError: transport.subscriptionError,
      pending: snapshot.pending,
      pendingUserInputCount: snapshot.pendingUserInputs.length,
      errorMessage: snapshot.errorMessage,
      selectedModelId: snapshot.selectedModelId,
      model: snapshot.model,
      messages: snapshot.messages as readonly AiChatMessage[],
    };
  });

  return {
    snapshotAtom,
    transportAtom,
    messagesAtom,
    pendingAtom,
    pendingUserInputsAtom,
    conversationIdAtom,
    canRetryAtom,
    errorMessageAtom,
    warningsAtom,
    scenarioIdAtom,
    selectedModelIdAtom,
    selectedAgentIdAtom,
    selectedReasoningLevelAtom,
    modelAtom,
    loadingAtom,
    subscriptionErrorAtom,
    statusMetaAtom,
  };
});
