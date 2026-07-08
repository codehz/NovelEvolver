import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { ScrollArea } from "#app/shared/ui/ScrollArea";

import { useAiChatState } from "./use-ai-chat-state";

const messageBubbleClass = cn("max-w-[92%] rounded-lg px-3 py-2");
const userMessageBubbleClass = cn(messageBubbleClass, "ml-4 self-end bg-window-chrome");
const assistantMessageBubbleClass = cn(messageBubbleClass, "mr-4 self-start bg-app-background");
const metadataBadgeClass = cn(
  "inline-flex items-center rounded-full bg-window-chrome px-2 py-0.5 text-2xs font-medium text-ctp-subtext1",
);

export function AuxiliaryPanel() {
  const { snapshot, loading, subscriptionError, sendMessage, resetConversation } = useAiChatState();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [snapshot.messages, snapshot.pending]);

  const submitDraft = useCallback(async (): Promise<void> => {
    const submitted = await sendMessage(draft);
    if (submitted) {
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
      <ScrollArea className="min-h-0 flex-1" fill>
        <div className="flex flex-col gap-3 p-3 text-sm">
          <div className="flex items-center justify-between gap-2 rounded-lg bg-app-background px-3 py-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className={metadataBadgeClass}>{snapshot.adapterKind}</span>
              <span className={metadataBadgeClass}>{snapshot.model}</span>
            </div>
            <button
              className="rounded-md px-2 py-1 text-xs text-ctp-subtext1 hover:bg-window-chrome"
              disabled={snapshot.pending}
              type="button"
              onClick={() => {
                void resetConversation();
              }}
            >
              清空对话
            </button>
          </div>

          {errorMessage ? (
            <div className="rounded-lg border border-ctp-red/40 bg-ctp-red/10 px-3 py-2 text-xs text-ctp-red">
              {errorMessage}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-lg bg-app-background px-3 py-4 text-center text-xs text-ctp-subtext0">
              正在连接 AI 会话…
            </div>
          ) : null}

          {!loading && snapshot.messages.length === 0 ? (
            <div className="rounded-lg bg-app-background px-3 py-4 text-sm text-ctp-subtext0">
              这里已经接上 `@codehz/ai` 的 mock 对话流。输入一句话即可验证 RPC 和前端渲染链路。
            </div>
          ) : null}

          {snapshot.messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user" ? userMessageBubbleClass : assistantMessageBubbleClass
              }
            >
              <p className="mb-1 text-xs font-medium text-ctp-subtext0">
                {message.role === "user" ? "你" : "助手"}
              </p>
              <p className="whitespace-pre-wrap text-app-foreground">{message.text || "思考中…"}</p>
              {message.status === "streaming" ? (
                <p className="mt-2 text-2xs text-ctp-subtext1">流式输出中…</p>
              ) : null}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      <footer className="shrink-0 border-t border-titlebar-border p-3">
        <form
          className="flex items-end gap-2 rounded-lg bg-app-background p-2"
          onSubmit={handleSubmit}
        >
          <textarea
            aria-label="消息输入"
            className="min-h-16 flex-1 resize-none border-0 bg-transparent text-sm text-app-foreground outline-none placeholder:text-ctp-overlay0"
            placeholder="向 AI 提问…"
            rows={3}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onKeyDown={handleComposerKeyDown}
            disabled={loading || snapshot.pending}
          />
          <button
            aria-label="发送"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-badge-background text-badge-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={loading || snapshot.pending || draft.trim() === ""}
            type="button"
            onClick={handleSendClick}
          >
            <span aria-hidden="true" className="icon-[codicon--send] text-sm" />
          </button>
        </form>
      </footer>
    </>
  );
}
