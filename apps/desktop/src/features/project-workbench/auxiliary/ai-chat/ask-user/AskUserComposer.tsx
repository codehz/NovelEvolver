import { useEffect, useRef, type KeyboardEvent } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import {
  controlDisabledSoftClass,
  controlFocusVisibleClass,
  rowHoverClass,
} from "#app/shared/lib/ui/interaction-chrome";
import { Button } from "#app/shared/ui";
import type { AskUserOpenInteraction } from "#domain/ai";

import {
  askUserCardShellClass,
  askUserPromptScrollClass,
  askUserTextareaClass,
  toolCallLabelClass,
} from "../ui/ai-chat-chrome";

const headerClass = cn("flex shrink-0 items-center gap-1.5 px-1");
const headerToolNameClass = cn("truncate font-mono text-2xs text-ctp-overlay0");
const questionClass = cn("px-1 text-chat leading-5 text-app-foreground");
const contextClass = cn("px-1 text-chat-meta leading-5 text-app-muted");
const choicesClass = cn("flex flex-col gap-1 px-1");
const choicesLabelClass = cn("text-2xs font-medium text-ctp-subtext1");
const choiceButtonClass = cn(
  "flex flex-col gap-0.5 rounded-sm px-2 py-1.5 text-left transition-colors outline-none",
  rowHoverClass,
  controlFocusVisibleClass,
  controlDisabledSoftClass,
);
const choiceTitleClass = cn("text-chat-meta leading-5 text-app-foreground");
const choiceDescriptionClass = cn("text-2xs leading-4 text-app-muted");
const loadingClass = cn(
  "mx-auto w-full max-w-3xl rounded-lg bg-app-background p-3 text-center text-chat-meta text-ctp-subtext0",
);

/**
 * `ask_user` 单题草稿 UI。展示字段来自纯 DTO；提交/取消由外层 shell 统一处理。
 */
type AskUserComposerProps = {
  input: AskUserOpenInteraction;
  disabled: boolean;
  draft: string;
  onDraftChange: (draft: string) => void;
  /** 单题编辑时 Enter 可跳到「下一题 / 提交全部」的入口，由 shell 决定。 */
  onRequestCommit?: () => void;
};

export function AskUserComposer({
  input,
  disabled,
  draft,
  onDraftChange,
  onRequestCommit,
}: AskUserComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const choices = input.choices ?? [];
  const hasChoices = choices.length > 0;

  useEffect(() => {
    if (disabled) {
      return;
    }
    textareaRef.current?.focus();
  }, [disabled, input.id]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }
    event.preventDefault();
    onRequestCommit?.();
  };

  if (!input.question) {
    return <div className={loadingClass}>正在加载问题…</div>;
  }

  return (
    <div className={askUserCardShellClass}>
      <div className={headerClass}>
        <span className={toolCallLabelClass}>需要你回答</span>
        <span className={headerToolNameClass}>{input.toolName}</span>
      </div>

      <div className={askUserPromptScrollClass}>
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
                disabled={disabled}
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
      </div>

      <textarea
        aria-label={input.question}
        className={askUserTextareaClass}
        disabled={disabled}
        placeholder={input.placeholder ?? "输入你的回答…"}
        ref={textareaRef}
        rows={4}
        value={draft}
        onChange={(event) => {
          onDraftChange(event.target.value);
        }}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
