import type { KeyboardEvent, RefObject, SubmitEvent } from "react";

import {
  agentSelectorButtonClass,
  composerShellClass,
  composerTextareaClass,
  modelSelectorButtonClass,
  modelSelectorLabelClass,
  sendButtonClass,
  stopButtonClass,
} from "../ui/ai-chat-ui";

export function AiChatMessageComposer({
  draft,
  composerDisabled,
  selectorDisabled,
  canSend,
  canStop,
  selectedAgentLabel,
  selectedModelLabel,
  composerRef,
  onDraftChange,
  onSubmit,
  onSendClick,
  onStopClick,
  onComposerKeyDown,
  onPickAgent,
  onPickModel,
}: {
  draft: string;
  composerDisabled: boolean;
  selectorDisabled: boolean;
  canSend: boolean;
  canStop: boolean;
  selectedAgentLabel: string;
  selectedModelLabel: string;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  onDraftChange: (value: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onSendClick: () => void;
  onStopClick: () => void;
  onComposerKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPickAgent: () => void;
  onPickModel: () => void;
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
        <button
          aria-label="选择 Agent"
          className={agentSelectorButtonClass}
          disabled={selectorDisabled}
          title={selectedAgentLabel}
          type="button"
          onClick={onPickAgent}
        >
          <span aria-hidden="true" className="icon-[codicon--hubot] shrink-0 text-xs" />
          <span className={modelSelectorLabelClass}>{selectedAgentLabel}</span>
        </button>
        <span aria-hidden="true" className="mx-0.5 h-4 w-px shrink-0 bg-titlebar-border" />
        <button
          aria-label="选择模型"
          className={modelSelectorButtonClass}
          disabled={selectorDisabled}
          title={selectedModelLabel}
          type="button"
          onClick={onPickModel}
        >
          <span aria-hidden="true" className="icon-[codicon--sparkle] shrink-0 text-xs" />
          <span className={modelSelectorLabelClass}>{selectedModelLabel}</span>
        </button>
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
