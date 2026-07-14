import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type SubmitEvent,
} from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { controlFocusVisibleClass, rowHoverClass } from "#app/shared/lib/ui/interaction-chrome";
import { Button, AppTooltip } from "#app/shared/ui";
import type { AskUserPendingInput } from "#shared/rpc/ai/index";

import {
  composerShellClass,
  composerTextareaClass,
  sendButtonClass,
  stopButtonClass,
  toolCallLabelClass,
} from "../ui/ai-chat-chrome";

const headerClass = cn("flex items-center gap-1.5 px-1");
const headerToolNameClass = cn("truncate font-mono text-2xs text-ctp-overlay0");
const questionClass = cn("px-1 text-chat leading-5 text-app-foreground");
const contextClass = cn("px-1 text-chat-meta leading-5 text-app-muted");
const choicesClass = cn("flex flex-col gap-1 px-1");
const choicesLabelClass = cn("text-2xs font-medium text-ctp-subtext1");
const choiceButtonClass = cn(
  "flex flex-col gap-0.5 rounded-sm px-2 py-1.5 text-left transition-colors outline-none",
  rowHoverClass,
  controlFocusVisibleClass,
  "disabled:cursor-not-allowed disabled:opacity-40",
);
const choiceTitleClass = cn("text-chat-meta leading-5 text-app-foreground");
const choiceDescriptionClass = cn("text-2xs leading-4 text-app-muted");
const loadingClass = cn(
  "mx-auto w-full max-w-3xl rounded-lg bg-app-background p-3 text-center text-chat-meta text-ctp-subtext0",
);

/**
 * `ask_user` 工具的输入 UI。展示字段来自 DTO；提交时调用 `input.handle.submitAnswer(text)`。
 */
type AskUserComposerProps = {
  input: AskUserPendingInput;
  loading: boolean;
  draft: string;
  onDraftChange: (draft: string) => void;
  onSubmitted: () => void;
};

export function AskUserComposer({
  input,
  loading,
  draft,
  onDraftChange,
  onSubmitted,
}: AskUserComposerProps) {
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const choices = input.choices ?? [];
  const hasChoices = choices.length > 0;
  const inputDisabled = loading || submitting;

  useEffect(() => {
    textareaRef.current?.focus();
  }, [input.handle]);

  const submitDraft = useCallback(async (): Promise<void> => {
    if (inputDisabled || draft.trim() === "") {
      return;
    }

    setSubmitting(true);
    input.handle.submitAnswer(draft.trim());
    setSubmitting(false);
    onSubmitted();
  }, [draft, input.handle, inputDisabled, onSubmitted]);

  const handleSubmit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      void submitDraft();
    },
    [submitDraft],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }

      event.preventDefault();
      void submitDraft();
    },
    [submitDraft],
  );

  const handleCancel = useCallback(() => {
    if (inputDisabled) {
      return;
    }
    input.handle.cancel();
    onSubmitted();
  }, [input.handle, inputDisabled, onSubmitted]);

  if (!input.question) {
    return <div className={loadingClass}>正在加载问题…</div>;
  }

  return (
    <form className={composerShellClass} onSubmit={handleSubmit}>
      <div className={headerClass}>
        <span className={toolCallLabelClass}>需要你回答</span>
        <span className={headerToolNameClass}>{input.toolName}</span>
      </div>

      <p className={questionClass}>{input.question}</p>
      {input.context ? <p className={contextClass}>{input.context}</p> : null}

      {hasChoices ? (
        <div className={choicesClass}>
          <p className={choicesLabelClass}>参考选项（点击快速填入）</p>
          {choices.map((choice) => (
            <Button
              key={choice.title}
              variant="ghost"
              className={choiceButtonClass}
              disabled={inputDisabled}
              onClick={() => {
                onDraftChange(choice.title);
                textareaRef.current?.focus();
              }}
            >
              <span className={choiceTitleClass}>{choice.title}</span>
              {choice.description ? (
                <span className={choiceDescriptionClass}>{choice.description}</span>
              ) : null}
            </Button>
          ))}
        </div>
      ) : null}

      <textarea
        aria-label={input.question}
        className={composerTextareaClass}
        disabled={inputDisabled}
        placeholder={input.placeholder ?? "输入你的回答…"}
        ref={textareaRef}
        rows={4}
        value={draft}
        onChange={(event) => {
          onDraftChange(event.target.value);
        }}
        onKeyDown={handleKeyDown}
      />

      <div className="flex min-w-0 items-center justify-end gap-1">
        <AppTooltip label="取消回答" side="top" disabled={inputDisabled}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="取消回答"
            className={cn(
              stopButtonClass,
              "disabled:cursor-not-allowed disabled:text-ctp-overlay0 hover:disabled:bg-transparent",
            )}
            disabled={inputDisabled}
            onClick={handleCancel}
          >
            <span aria-hidden="true" className="icon-[codicon--close] text-sm" />
          </Button>
        </AppTooltip>
        <AppTooltip label="提交回答" side="top" disabled={inputDisabled || draft.trim() === ""}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="提交回答"
            className={sendButtonClass}
            disabled={inputDisabled || draft.trim() === ""}
            type="submit"
          >
            <span aria-hidden="true" className="icon-[codicon--newline] text-sm" />
          </Button>
        </AppTooltip>
      </div>
    </form>
  );
}
