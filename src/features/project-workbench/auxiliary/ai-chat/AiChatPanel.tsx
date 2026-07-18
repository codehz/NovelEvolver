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
  const { retryLastRequest } = useAiChatActions();
  const mockAiAvailable = useMockAiAvailable();
  const composer = useAiChatComposer();

  const retryTurn = useCallback(() => {
    void retryLastRequest();
  }, [retryLastRequest]);
  const handleRetry = snapshot.canRetry && !subscriptionError ? retryTurn : undefined;

  return (
    <>
      <AiChatHeaderActions mockAiAvailable={mockAiAvailable} onClearDraft={composer.clearDraft} />
      <AiChatConversationRail
        loading={loading}
        snapshot={snapshot}
        subscriptionError={subscriptionError}
        turnError={snapshot.errorMessage}
        onRetry={handleRetry}
      />
      <AiChatComposerFooter composer={composer} />
    </>
  );
}
