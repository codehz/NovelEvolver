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

  const handleRetry =
    snapshot.canRetry && !subscriptionError
      ? () => {
          void retryLastRequest();
        }
      : undefined;

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
