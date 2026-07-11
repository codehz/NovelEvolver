import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type SubmitEvent,
} from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { ScrollArea } from "#app/shared/ui/ScrollArea";
import { SidebarHeaderActionButton, SidebarHeaderActions } from "#workbench/chrome";

import { pickAiConversation } from "./ai-chat-history-quick-pick";
import {
  composerShellClass,
  composerTextareaClass,
  conversationRailClass,
  panelSectionClass,
  sendButtonClass,
} from "./ai-chat-ui";
import { AiMessageBlock } from "./AiMessageBlock";
import { AskUserComposerPanel } from "./AskUserComposerPanel";
import { useAiChatState } from "./use-ai-chat-state";

export function AuxiliaryPanel() {
  const {
    snapshot,
    loading,
    subscriptionError,
    sendMessage,
    createConversation,
    listConversations,
    switchConversation,
  } = useAiChatState();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const shouldRestoreComposerFocusRef = useRef(false);

  const hasPendingUserInputs = snapshot.pendingUserInputs.length > 0;
  const conversationActionsDisabled = loading || snapshot.pending || hasPendingUserInputs;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [snapshot.messages, snapshot.pending, snapshot.pendingUserInputs]);

  useEffect(() => {
    if (
      loading ||
      snapshot.pending ||
      hasPendingUserInputs ||
      !shouldRestoreComposerFocusRef.current
    ) {
      return;
    }

    composerRef.current?.focus();
    shouldRestoreComposerFocusRef.current = false;
  }, [hasPendingUserInputs, loading, snapshot.pending]);

  const submitDraft = useCallback(async (): Promise<void> => {
    const submitted = await sendMessage(draft);
    if (submitted) {
      shouldRestoreComposerFocusRef.current = true;
      setDraft("");
    }
  }, [draft, sendMessage]);

  const handleSubmit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
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

  const handleOpenHistory = useCallback(async () => {
    if (conversationActionsDisabled) {
      return;
    }

    const conversations = await listConversations();
    const selectedId = await pickAiConversation({
      conversations,
      activeConversationId: snapshot.conversationId,
    });
    if (selectedId === null || selectedId === snapshot.conversationId) {
      return;
    }

    setDraft("");
    await switchConversation(selectedId);
  }, [conversationActionsDisabled, listConversations, snapshot.conversationId, switchConversation]);

  const handleCreateConversation = useCallback(async () => {
    if (conversationActionsDisabled) {
      return;
    }

    setDraft("");
    await createConversation();
  }, [conversationActionsDisabled, createConversation]);

  const errorMessage = subscriptionError ?? snapshot.errorMessage;

  return (
    <>
      <SidebarHeaderActions>
        <SidebarHeaderActionButton
          disabled={conversationActionsDisabled}
          icon="icon-[codicon--history]"
          label="历史会话"
          onClick={() => {
            void handleOpenHistory();
          }}
        />
        <SidebarHeaderActionButton
          disabled={conversationActionsDisabled}
          icon="icon-[codicon--add]"
          label="新建会话"
          onClick={() => {
            void handleCreateConversation();
          }}
        />
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
        {hasPendingUserInputs ? (
          <AskUserComposerPanel loading={loading} pendingInputs={snapshot.pendingUserInputs} />
        ) : (
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
        )}
      </footer>
    </>
  );
}
