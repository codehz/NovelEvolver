import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Streamdown } from "streamdown";

import { cn } from "#app/shared/lib/ui/cn";
import { ScrollArea } from "#app/shared/ui/ScrollArea";
import type { AiChatMessage } from "#shared/rpc/ai-rpc";
import { SidebarHeaderActions, sidebarHeaderActionClass } from "#workbench/chrome";

import { useAiChatState } from "./use-ai-chat-state";

const panelSectionClass = cn("mx-auto flex w-full max-w-3xl flex-col");
const conversationRailClass = cn("gap-4 px-3 py-2.5");
const assistantMessageBlockClass = cn("w-full px-1");
const assistantMessageBodyClass = cn(
  "text-[0.8125rem] leading-5 text-app-foreground",
  "[&_a]:text-ctp-blue [&_a]:underline [&_a]:underline-offset-2",
  "[&_code]:rounded-md [&_code]:bg-window-chrome [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.75rem]",
  "**:data-[streamdown='blockquote']:border-ctp-blue/40 **:data-[streamdown='blockquote']:text-app-muted",
  "**:data-[streamdown='code-block']:border-titlebar-border **:data-[streamdown='code-block']:bg-app-surface",
  "**:data-[streamdown='code-block-actions']:border-titlebar-border **:data-[streamdown='code-block-actions']:bg-app-surface/80",
  "**:data-[streamdown='code-block-body']:border-titlebar-border **:data-[streamdown='code-block-body']:bg-window-chrome",
  "**:data-[streamdown='heading-1']:text-base",
  "**:data-[streamdown='heading-1']:text-ctp-mauve **:data-[streamdown='heading-2']:text-ctp-mauve **:data-[streamdown='heading-3']:text-ctp-mauve",
  "**:data-[streamdown='inline-code']:text-ctp-green",
);
const userMessageRowClass = cn("flex justify-end");
const userMessageBubbleClass = cn(
  "max-w-[88%] rounded-xl bg-window-chrome px-3 py-2 text-[0.8125rem] leading-5 text-app-foreground shadow-[inset_0_1px_0_0_color-mix(in_srgb,var(--color-ctp-surface0)_24%,transparent)]",
);
const composerShellClass = cn(
  "mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-xl bg-app-background p-2",
);
const composerTextareaClass = cn(
  "field-sizing-content min-h-24 w-full resize-none border-0 bg-transparent p-1 text-[0.8125rem] leading-5 text-app-foreground outline-none placeholder:text-ctp-overlay0",
);
const sendButtonClass = cn(
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-badge-background text-badge-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40",
);

function AiMessageBlock({ message }: { message: AiChatMessage }) {
  if (message.role === "user") {
    return (
      <div className={userMessageRowClass}>
        <div className={userMessageBubbleClass}>
          <p className="whitespace-pre-wrap">{message.text}</p>
        </div>
      </div>
    );
  }

  const isStreaming = message.status === "streaming";

  return (
    <article className={assistantMessageBlockClass}>
      <div className={assistantMessageBodyClass}>
        {message.text !== "" ? (
          <Streamdown animated className="text-inherit" isAnimating={isStreaming}>
            {message.text}
          </Streamdown>
        ) : (
          <p className="text-ctp-subtext0">思考中…</p>
        )}
      </div>

      {isStreaming ? <p className="mt-2 text-2xs text-ctp-subtext1">流式输出中…</p> : null}
    </article>
  );
}

export function AuxiliaryPanel() {
  const { snapshot, loading, subscriptionError, sendMessage, resetConversation } = useAiChatState();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const shouldRestoreComposerFocusRef = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [snapshot.messages, snapshot.pending]);

  useEffect(() => {
    if (loading || snapshot.pending || !shouldRestoreComposerFocusRef.current) {
      return;
    }

    composerRef.current?.focus();
    shouldRestoreComposerFocusRef.current = false;
  }, [loading, snapshot.pending]);

  const submitDraft = useCallback(async (): Promise<void> => {
    const submitted = await sendMessage(draft);
    if (submitted) {
      shouldRestoreComposerFocusRef.current = true;
      setDraft("");
    }
  }, [draft, sendMessage]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void submitDraft();
    },
    [submitDraft],
  );

  const handleSendClick = useCallback(() => {
    void submitDraft();
  }, [submitDraft]);

  const handleComposerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }

      event.preventDefault();
      void submitDraft();
    },
    [submitDraft],
  );

  const errorMessage = subscriptionError ?? snapshot.errorMessage;

  return (
    <>
      <SidebarHeaderActions>
        <button
          aria-label="清空对话"
          className={sidebarHeaderActionClass}
          disabled={snapshot.pending}
          title="清空对话"
          type="button"
          onClick={() => {
            void resetConversation();
          }}
        >
          <span aria-hidden="true" className="icon-[codicon--clear-all] text-sm" />
        </button>
      </SidebarHeaderActions>

      <ScrollArea className="min-h-0 flex-1" fill>
        <div className={cn(panelSectionClass, conversationRailClass, "text-sm")}>
          {errorMessage ? (
            <div className="rounded-xl border border-ctp-red/40 bg-ctp-red/10 px-3 py-2 text-xs text-ctp-red">
              {errorMessage}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-xl bg-app-background p-3 text-center text-xs text-ctp-subtext0">
              正在连接 AI 会话…
            </div>
          ) : null}

          {!loading && snapshot.messages.length === 0 ? (
            <div className="px-1 py-4 text-xs text-ctp-subtext0">开始一段对话。</div>
          ) : null}

          {snapshot.messages.map((message) => (
            <AiMessageBlock key={message.id} message={message} />
          ))}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-0"
            ref={endRef}
          />
        </div>
      </ScrollArea>

      <footer className="shrink-0 p-3">
        <form className={composerShellClass} onSubmit={handleSubmit}>
          <textarea
            aria-label="消息输入"
            className={composerTextareaClass}
            ref={composerRef}
            placeholder="输入章节目标、修改要求，或直接粘贴长段正文…"
            rows={6}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onKeyDown={handleComposerKeyDown}
            disabled={loading || snapshot.pending}
          />

          <div className="flex justify-end">
            <button
              aria-label="发送"
              className={sendButtonClass}
              disabled={loading || snapshot.pending || draft.trim() === ""}
              title="发送"
              type="button"
              onClick={handleSendClick}
            >
              <span aria-hidden="true" className="icon-[codicon--send] text-sm" />
            </button>
          </div>
        </form>
      </footer>
    </>
  );
}
