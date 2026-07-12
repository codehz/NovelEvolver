import { AiChatComposerFooter } from "./conversation/AiChatComposerFooter";
import { AiChatConversationRail } from "./conversation/AiChatConversationRail";
import { AiChatHeaderActions } from "./conversation/AiChatHeaderActions";
import { useAiChatComposer } from "./hooks/use-ai-chat-composer";
import { useMockAiAvailable } from "./hooks/use-mock-ai-available";
import { useAiChatState } from "./state/use-ai-chat-state";

export function AiChatPanel() {
  const { snapshot, loading, subscriptionError } = useAiChatState();
  const mockAiAvailable = useMockAiAvailable();
  const composer = useAiChatComposer();

  const errorMessage = subscriptionError ?? snapshot.errorMessage;

  return (
    <>
      <AiChatHeaderActions mockAiAvailable={mockAiAvailable} onClearDraft={composer.clearDraft} />
      <AiChatConversationRail errorMessage={errorMessage} loading={loading} snapshot={snapshot} />
      <AiChatComposerFooter composer={composer} />
    </>
  );
}
