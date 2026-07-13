import { AiChatComposerFooter } from "./conversation/AiChatComposerFooter";
import { AiChatConversationRail } from "./conversation/AiChatConversationRail";
import { AiChatHeaderActions } from "./conversation/AiChatHeaderActions";
import { useAiChatComposer } from "./hooks/use-ai-chat-composer";
import { useMockAiAvailable } from "./hooks/use-mock-ai-available";
import { useAiChatState } from "./state/use-ai-chat-state";

export function AiChatPanel() {
  const { snapshot, loading, subscriptionError, retryLastRequest } = useAiChatState();
  const mockAiAvailable = useMockAiAvailable();
  const composer = useAiChatComposer();

  const errorMessage = subscriptionError ?? snapshot.errorMessage;
  const showRetry = !subscriptionError && !!snapshot.errorMessage;

  const handleRetry = showRetry
    ? () => {
        void retryLastRequest();
      }
    : undefined;

  return (
    <>
      <AiChatHeaderActions mockAiAvailable={mockAiAvailable} onClearDraft={composer.clearDraft} />
      <AiChatConversationRail
        errorMessage={errorMessage}
        loading={loading}
        snapshot={snapshot}
        onRetry={handleRetry}
      />
      <AiChatComposerFooter composer={composer} />
    </>
  );
}
