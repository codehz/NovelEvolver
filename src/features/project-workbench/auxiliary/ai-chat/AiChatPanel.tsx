import { useCallback } from "react";

import { AiChatComposerFooter } from "./conversation/AiChatComposerFooter";
import { AiChatConversationRail } from "./conversation/AiChatConversationRail";
import { AiChatHeaderActions } from "./conversation/AiChatHeaderActions";
import { useAiChatComposer } from "./hooks/use-ai-chat-composer";
import { useMockAiAvailable } from "./hooks/use-mock-ai-available";
import {
  useAiChatActions,
  useAiChatLoading,
  useAiChatSnapshot,
  useAiChatSubscriptionError,
} from "./state/use-ai-chat-state";

export function AiChatPanel() {
  const snapshot = useAiChatSnapshot();
  const loading = useAiChatLoading();
  const subscriptionError = useAiChatSubscriptionError();
  const {
    retryLastRequest,
    forkFromMessage,
    selectMessageBranch,
    selectMessageContinuation,
    editUserMessage,
  } = useAiChatActions();
  const mockAiAvailable = useMockAiAvailable();
  const composer = useAiChatComposer();

  const retryTurn = useCallback(() => {
    void retryLastRequest();
  }, [retryLastRequest]);
  const handleRetry = snapshot.canRetry && !subscriptionError ? retryTurn : undefined;

  const branchActionsDisabled =
    snapshot.pending || snapshot.pendingUserInputs.length > 0 || subscriptionError != null;

  const handleFork = useCallback(
    (messageId: string) => {
      void forkFromMessage(messageId);
    },
    [forkFromMessage],
  );

  const handleSelectBranch = useCallback(
    (messageId: string, index: number) => {
      void selectMessageBranch(messageId, index);
    },
    [selectMessageBranch],
  );

  const handleSelectContinuation = useCallback(
    (messageId: string, index: number) => {
      void selectMessageContinuation(messageId, index);
    },
    [selectMessageContinuation],
  );

  const handleEditUser = useCallback(
    (messageId: string, text: string) => {
      const target = snapshot.messages.find((message) => message.id === messageId);
      if (!target || target.role !== "user") {
        return;
      }
      // MVP: edit text only; keep insert-time slash/mentions snapshots.
      void editUserMessage(messageId, {
        text,
        slash: target.slash,
        mentions: target.mentions,
      });
    },
    [editUserMessage, snapshot.messages],
  );

  return (
    <>
      <AiChatHeaderActions mockAiAvailable={mockAiAvailable} onClearDraft={composer.clearDraft} />
      <AiChatConversationRail
        loading={loading}
        snapshot={snapshot}
        subscriptionError={subscriptionError}
        turnError={snapshot.errorMessage}
        onRetry={handleRetry}
        actionsDisabled={branchActionsDisabled}
        onFork={branchActionsDisabled ? undefined : handleFork}
        onSelectBranch={branchActionsDisabled ? undefined : handleSelectBranch}
        onSelectContinuation={branchActionsDisabled ? undefined : handleSelectContinuation}
        onEditUser={branchActionsDisabled ? undefined : handleEditUser}
      />
      <AiChatComposerFooter composer={composer} />
    </>
  );
}
