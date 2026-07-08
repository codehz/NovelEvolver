import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { cn } from "#app/shared/lib/ui/cn";
import type { AiChatToolCall } from "#shared/rpc/ai-rpc";

import { normalizeAskUserChoices, parseAskUserToolArguments } from "./ask-user-prompt";

const composerShellClass = cn(
  "mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-xl bg-app-background p-2 ring-1 ring-ctp-blue/30",
);
const headerClass = cn("flex items-center gap-1.5 px-1");
const headerLabelClass = cn("text-2xs font-medium tracking-[0.02em] text-ctp-blue");
const headerToolNameClass = cn("truncate font-mono text-2xs text-ctp-green");
const questionClass = cn("px-1 text-[0.8125rem] leading-5 text-app-foreground");
const contextClass = cn("px-1 text-2xs leading-4 text-ctp-subtext1");
const choicesClass = cn("flex flex-col gap-1.5 px-1");
const choicesLabelClass = cn("text-2xs font-medium text-ctp-subtext0");
const choiceButtonClass = cn(
  "flex flex-col gap-0.5 rounded-md border border-titlebar-border bg-app-surface px-2.5 py-1.5 text-left hover:bg-window-chrome disabled:cursor-not-allowed disabled:opacity-40",
);
const choiceTitleClass = cn("text-[0.75rem] leading-5 text-app-foreground");
const choiceDescriptionClass = cn("text-2xs leading-4 text-ctp-subtext1");
const composerTextareaClass = cn(
  "field-sizing-content min-h-20 w-full resize-none border-0 bg-transparent p-1 text-[0.8125rem] leading-5 text-app-foreground outline-none placeholder:text-ctp-overlay0",
);
const sendButtonClass = cn(
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-badge-background text-badge-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40",
);
const loadingClass = cn(
  "mx-auto w-full max-w-3xl rounded-xl bg-app-background p-3 text-center text-xs text-ctp-subtext0",
);

export function AskUserComposer({
  toolCall,
  loading,
  onSubmit,
}: {
  toolCall: AiChatToolCall;
  loading: boolean;
  onSubmit: (toolCallId: string, text: string) => Promise<boolean>;
}) {
  const args = parseAskUserToolArguments(toolCall.argumentsText);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const choices = normalizeAskUserChoices(args?.choices);
  const hasChoices = choices.length > 0;
  const inputDisabled = loading || submitting;

  useEffect(() => {
    textareaRef.current?.focus();
  }, [toolCall.id]);

  const submitDraft = useCallback(async (): Promise<void> => {
    if (inputDisabled || draft.trim() === "") {
      return;
    }

    setSubmitting(true);
    const submitted = await onSubmit(toolCall.id, draft);
    setSubmitting(false);
    if (submitted) {
      setDraft("");
    }
  }, [draft, inputDisabled, onSubmit, toolCall.id]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
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

  if (!args?.question) {
    return <div className={loadingClass}>正在加载问题…</div>;
  }

  return (
    <form className={composerShellClass} onSubmit={handleSubmit}>
      <div className={headerClass}>
        <span className={headerLabelClass}>需要你回答</span>
        <span className={headerToolNameClass}>{toolCall.name}</span>
      </div>

      <p className={questionClass}>{args.question}</p>
      {args.context ? <p className={contextClass}>{args.context}</p> : null}

      {hasChoices ? (
        <div className={choicesClass}>
          <p className={choicesLabelClass}>参考选项（点击快速填入）</p>
          {choices.map((choice) => (
            <button
              key={choice.title}
              className={choiceButtonClass}
              disabled={inputDisabled}
              type="button"
              onClick={() => {
                setDraft(choice.title);
                textareaRef.current?.focus();
              }}
            >
              <span className={choiceTitleClass}>{choice.title}</span>
              {choice.description ? (
                <span className={choiceDescriptionClass}>{choice.description}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      <textarea
        aria-label={args.question}
        className={composerTextareaClass}
        disabled={inputDisabled}
        placeholder={args.placeholder ?? "输入你的回答…"}
        ref={textareaRef}
        rows={4}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onKeyDown={handleKeyDown}
      />

      <div className="flex justify-end">
        <button
          aria-label="提交回答"
          className={sendButtonClass}
          disabled={inputDisabled || draft.trim() === ""}
          title="提交回答"
          type="submit"
        >
          <span aria-hidden="true" className="icon-[codicon--send] text-sm" />
        </button>
      </div>
    </form>
  );
}
