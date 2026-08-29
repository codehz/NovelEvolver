import { AskUserComposerPanel } from "../ask-user/AskUserComposerPanel";
import type { AiChatComposerState } from "../hooks/use-ai-chat-composer";
import { useAiChatSelectors } from "../hooks/use-ai-chat-selectors";
import { useAiChatLoading, useAiChatSnapshot } from "../state/use-ai-chat-state";
import { AiChatMessageComposer } from "./AiChatMessageComposer";

type AiChatComposerFooterProps = { composer: AiChatComposerState };

export function AiChatComposerFooter({ composer }: AiChatComposerFooterProps) {
  const snapshot = useAiChatSnapshot();
  const loading = useAiChatLoading();
  const {
    composerRef,
    composerDisabled,
    hasOpenInteractions,
    canSend,
    canStop,
    handleSubmit,
    handleSendClick,
    handleStopClick,
    handleComposerSubmitKey,
    handleDocChange,
  } = composer;

  const {
    selectedModelLabel,
    selectedAgentLabel,
    selectedReasoningLabel,
    selectedReasoningLevel,
    availableReasoningLevels,
    showReasoningSelector,
    agentItems,
    modelItems,
    selectorDisabled,
    modelSelectorDisabled,
    handleOpenAgentPicker,
    handleOpenModelPicker,
    handleSelectModel,
    handleSelectAgent,
    handleSelectReasoningLevel,
  } = useAiChatSelectors();

  if (hasOpenInteractions) {
    return (
      <footer className="min-h-0 shrink-0 p-3">
        <AskUserComposerPanel loading={loading} openInteractions={snapshot.openInteractions} />
      </footer>
    );
  }

  return (
    <footer className="min-h-0 shrink-0 p-3">
      <AiChatMessageComposer
        canSend={canSend}
        canStop={canStop}
        composerDisabled={composerDisabled}
        composerRef={composerRef}
        agentItems={agentItems}
        modelItems={modelItems}
        availableReasoningLevels={availableReasoningLevels}
        showReasoningSelector={showReasoningSelector}
        onComposerSubmitKey={handleComposerSubmitKey}
        onDocChange={handleDocChange}
        onOpenAgentPicker={handleOpenAgentPicker}
        onOpenModelPicker={handleOpenModelPicker}
        onSelectAgent={handleSelectAgent}
        onSelectModel={handleSelectModel}
        onSelectReasoningLevel={handleSelectReasoningLevel}
        onSendClick={handleSendClick}
        onStopClick={handleStopClick}
        onSubmit={handleSubmit}
        selectedAgentLabel={selectedAgentLabel}
        selectedModelLabel={selectedModelLabel}
        selectedReasoningLabel={selectedReasoningLabel}
        selectedReasoningLevel={selectedReasoningLevel}
        selectorDisabled={selectorDisabled}
        modelSelectorDisabled={modelSelectorDisabled}
      />
    </footer>
  );
}
