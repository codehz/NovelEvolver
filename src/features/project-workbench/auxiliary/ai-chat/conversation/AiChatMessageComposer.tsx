import type { KeyboardEvent, RefObject, SubmitEvent } from "react";

import { AiChatAgentSelector, AiChatModelSelector, type AiChatSelectorItem } from "../selectors";
import {
  composerShellClass,
  composerTextareaClass,
  sendButtonClass,
  stopButtonClass,
} from "../ui/ai-chat-ui";

export function AiChatMessageComposer({
  draft,
  composerDisabled,
  selectorDisabled,
  modelSelectorDisabled,
  canSend,
  canStop,
  selectedAgentLabel,
  selectedModelLabel,
  agentItems,
  modelItems,
  composerRef,
  onDraftChange,
  onSubmit,
  onSendClick,
  onStopClick,
  onComposerKeyDown,
  onOpenAgentPicker,
  onOpenModelPicker,
  onSelectAgent,
  onSelectModel,
}: {
  draft: string;
  composerDisabled: boolean;
  selectorDisabled: boolean;
  modelSelectorDisabled: boolean;
  canSend: boolean;
  canStop: boolean;
  selectedAgentLabel: string;
  selectedModelLabel: string;
  agentItems: readonly AiChatSelectorItem[];
  modelItems: readonly AiChatSelectorItem[];
  composerRef: RefObject<HTMLTextAreaElement | null>;
  onDraftChange: (value: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onSendClick: () => void;
  onStopClick: () => void;
  onComposerKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onOpenAgentPicker?: () => void;
  onOpenModelPicker?: () => void;
  onSelectAgent: (id: string) => void;
  onSelectModel: (id: string) => void;
}) {
  return (
    <form className={composerShellClass} onSubmit={onSubmit}>
      <textarea
        aria-label="消息输入"
        className={composerTextareaClass}
        ref={composerRef}
        placeholder="输入章节目标、修改要求，或直接粘贴长段正文…"
        rows={6}
        value={draft}
        onChange={(event) => {
          onDraftChange(event.target.value);
        }}
        onKeyDown={onComposerKeyDown}
        disabled={composerDisabled}
      />

      <div className="flex min-w-0 items-center gap-1">
        <AiChatAgentSelector
          label={selectedAgentLabel}
          disabled={selectorDisabled}
          items={agentItems}
          onOpen={onOpenAgentPicker}
          onSelect={onSelectAgent}
        />
        <span aria-hidden="true" className="mx-0.5 h-4 w-px shrink-0 bg-titlebar-border" />
        <AiChatModelSelector
          label={selectedModelLabel}
          disabled={modelSelectorDisabled}
          items={modelItems}
          onOpen={onOpenModelPicker}
          onSelect={onSelectModel}
        />
        <span className="min-w-0 flex-1" />
        {canStop ? (
          <button
            aria-label="停止"
            className={stopButtonClass}
            title="停止"
            type="button"
            onClick={onStopClick}
          >
            <span aria-hidden="true" className="icon-[codicon--debug-stop] text-sm" />
          </button>
        ) : (
          <button
            aria-label="发送"
            className={sendButtonClass}
            disabled={!canSend}
            title="发送"
            type="button"
            onClick={onSendClick}
          >
            <span aria-hidden="true" className="icon-[codicon--newline] text-sm" />
          </button>
        )}
      </div>
    </form>
  );
}
