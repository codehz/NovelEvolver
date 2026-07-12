import { AskUserComposerPanel } from "../ask-user/AskUserComposerPanel";
import type { AiChatComposerState } from "../hooks/use-ai-chat-composer";
import { useAiChatSelectors } from "../hooks/use-ai-chat-selectors";
import { useAiChatState } from "../state/use-ai-chat-state";
import { AiChatMessageComposer } from "./AiChatMessageComposer";

export function AiChatComposerFooter({ composer }: { composer: AiChatComposerState }) {
  const { snapshot, loading } = useAiChatState();
  const {
    draft,
    setDraft,
    composerRef,
    composerDisabled,
    hasPendingUserInputs,
    canSend,
    handleSubmit,
    handleSendClick,
    handleComposerKeyDown,
  } = composer;

  const {
    selectedModelLabel,
    selectedAgentLabel,
    selectorDisabled,
    handlePickModel,
    handlePickAgent,
  } = useAiChatSelectors();

  if (hasPendingUserInputs) {
    return (
      <footer className="shrink-0 p-3">
        <AskUserComposerPanel loading={loading} pendingInputs={snapshot.pendingUserInputs} />
      </footer>
    );
  }

  return (
    <footer className="shrink-0 p-3">
      <AiChatMessageComposer
        canSend={canSend}
        composerDisabled={composerDisabled}
        composerRef={composerRef}
        draft={draft}
        onComposerKeyDown={handleComposerKeyDown}
        onDraftChange={setDraft}
        onPickAgent={() => {
          void handlePickAgent();
        }}
        onPickModel={() => {
          void handlePickModel();
        }}
        onSendClick={handleSendClick}
        onSubmit={handleSubmit}
        selectedAgentLabel={selectedAgentLabel}
        selectedModelLabel={selectedModelLabel}
        selectorDisabled={selectorDisabled}
      />
    </footer>
  );
}
