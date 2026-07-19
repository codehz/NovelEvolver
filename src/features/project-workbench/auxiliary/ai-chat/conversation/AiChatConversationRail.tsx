import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import type { AiChatSnapshot } from "#shared/rpc/ai/index";

import { AiMessageBlock } from "../messages/AiMessageBlock";
import { ChatScroller, findDivergentIndex, useChatScroller } from "../scroller";
import {
  branchSuffixEnterClass,
  conversationLastTurnClass,
  conversationRailClass,
  conversationScrollerJumpButtonClass,
  conversationScrollerRootClass,
  conversationScrollerViewportClass,
  panelSectionClass,
} from "../ui/ai-chat-chrome";
import { groupChatWarnings } from "../ui/group-chat-warnings";
import { AiChatWarningBanner } from "./AiChatWarningBanner";

const turnErrorBannerClass = cn(
  "rounded-lg border border-ctp-red/40 bg-ctp-red/10 px-3 py-2 text-xs text-ctp-red",
);
const railItemStackClass = cn("flex flex-col gap-2");
/** Clear fade class after transition settles (duration-220 + buffer). */
const BRANCH_FADE_CLEAR_MS = 260;

type BranchSuffixFade = {
  token: number;
  fromIndex: number;
};

type PendingBranchFade = {
  requestId: number;
  prevMessages: readonly { id: string }[];
};

function RailItem({
  messageId,
  turnAnchor = false,
  pathMember = true,
  className,
  children,
}: {
  messageId: string;
  turnAnchor?: boolean;
  pathMember?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <ChatScroller.Item
      messageId={messageId}
      turnAnchor={turnAnchor}
      pathMember={pathMember}
      className={className}
    >
      {children}
    </ChatScroller.Item>
  );
}

/**
 * Opacity-only enter shell for branch-switch suffix rows.
 * Owns the item stack (gap) so message + warnings keep layout; no height animation.
 */
function BranchSuffixShell({
  fadeToken,
  children,
}: {
  fadeToken: number | null;
  children: ReactNode;
}) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (fadeToken == null) {
      setEntered(false);
      return;
    }
    setEntered(false);
    const frame = window.requestAnimationFrame(() => {
      setEntered(true);
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [fadeToken]);

  return (
    <div
      className={cn(railItemStackClass, fadeToken != null && branchSuffixEnterClass)}
      data-entered={fadeToken != null && entered ? "" : undefined}
    >
      {children}
    </div>
  );
}

type AiChatConversationRailProps = {
  snapshot: AiChatSnapshot;
  loading: boolean;
  /** Transport-level subscribe failure; stays at the top of the rail. */
  subscriptionError: string | null;
  /** Last model-request error; rendered under the last assistant turn. */
  turnError: string | null;
  onRetry?: () => void;
  actionsDisabled?: boolean;
  onSelectBranch?: (messageId: string, index: number) => void;
  onEditUser?: (messageId: string, text: string) => void;
};

function AiChatConversationRailBody({
  snapshot,
  loading,
  subscriptionError,
  turnError,
  onRetry,
  actionsDisabled = false,
  onSelectBranch,
  onEditUser,
}: AiChatConversationRailProps) {
  const { captureBranchPin, beginBranchPin } = useChatScroller();

  const { warningsByMessageId, orphanWarnings } = useMemo(
    () => groupChatWarnings(snapshot.messages, snapshot.warnings),
    [snapshot.messages, snapshot.warnings],
  );

  const showTurnRetry =
    onRetry !== undefined &&
    !snapshot.pending &&
    snapshot.openInteractions.length === 0 &&
    snapshot.canRetry;

  const lastAssistantMessageId = useMemo(() => {
    for (let index = snapshot.messages.length - 1; index >= 0; index -= 1) {
      const message = snapshot.messages[index];
      if (message?.role === "assistant") {
        return message.id;
      }
    }
    return null;
  }, [snapshot.messages]);

  /** Index of the last user message — start of the CSS min-height last-turn zone. */
  const lastUserMessageIndex = useMemo(() => {
    for (let index = snapshot.messages.length - 1; index >= 0; index -= 1) {
      if (snapshot.messages[index]?.role === "user") {
        return index;
      }
    }
    return -1;
  }, [snapshot.messages]);

  const retryLabel = turnError ? "重试" : "重新生成";

  const [pendingFade, setPendingFade] = useState<PendingBranchFade | null>(null);
  const [branchFade, setBranchFade] = useState<BranchSuffixFade | null>(null);

  // Once path.replaced lands, materialize the suffix fade range and drop pending.
  useEffect(() => {
    if (pendingFade == null) {
      return;
    }
    const prevMessages = pendingFade.prevMessages;
    const nextMessages = snapshot.messages;
    const samePath =
      prevMessages.length === nextMessages.length &&
      prevMessages.every((message, index) => message.id === nextMessages[index]?.id);
    if (samePath) {
      return;
    }
    setBranchFade({
      token: pendingFade.requestId,
      fromIndex: findDivergentIndex(prevMessages, nextMessages),
    });
    setPendingFade(null);
  }, [pendingFade, snapshot.messages]);

  useEffect(() => {
    if (branchFade == null) {
      return;
    }
    const token = branchFade.token;
    const timer = window.setTimeout(() => {
      setBranchFade((current) => (current?.token === token ? null : current));
    }, BRANCH_FADE_CLEAR_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [branchFade]);

  // Apply fade on the first paint after path.replaced (while pin is still pending),
  // not only after pending clear — avoids a full-opacity flash.
  const activeBranchFade = useMemo((): BranchSuffixFade | null => {
    if (pendingFade != null) {
      const prevMessages = pendingFade.prevMessages;
      const nextMessages = snapshot.messages;
      const samePath =
        prevMessages.length === nextMessages.length &&
        prevMessages.every((message, index) => message.id === nextMessages[index]?.id);
      if (!samePath) {
        return {
          token: pendingFade.requestId,
          fromIndex: findDivergentIndex(prevMessages, nextMessages),
        };
      }
    }
    return branchFade;
  }, [branchFade, pendingFade, snapshot.messages]);

  const handleSelectBranch = useCallback(
    (messageId: string, index: number) => {
      // Capture pin intent synchronously while the old path DOM is still mounted.
      const fromIndexInPath = snapshot.messages.findIndex((message) => message.id === messageId);
      if (fromIndexInPath >= 0) {
        const prevMessageIds = snapshot.messages.map((message) => message.id);
        const capture = captureBranchPin(messageId, fromIndexInPath, prevMessageIds);
        if (capture != null) {
          beginBranchPin(capture);
          setPendingFade({
            requestId: capture.requestId,
            prevMessages: snapshot.messages.map((message) => ({ id: message.id })),
          });
        }
      }
      onSelectBranch?.(messageId, index);
    },
    [beginBranchPin, captureBranchPin, onSelectBranch, snapshot.messages],
  );

  return (
    <>
      <ChatScroller.Viewport aria-label="对话消息" className={conversationScrollerViewportClass}>
        <ChatScroller.Content
          aria-busy={snapshot.pending || undefined}
          className={cn(panelSectionClass, conversationRailClass, "text-sm")}
        >
          {snapshot.scenarioId ? (
            <RailItem messageId="meta:scenario" pathMember={false}>
              <div className="text-2xs text-ctp-subtext0">
                测试场景 · <span className="font-mono text-ctp-mauve">{snapshot.scenarioId}</span>
              </div>
            </RailItem>
          ) : null}

          {subscriptionError ? (
            <RailItem messageId="meta:subscription-error" pathMember={false}>
              <div className={turnErrorBannerClass}>{subscriptionError}</div>
            </RailItem>
          ) : null}

          {orphanWarnings.map((warning) => (
            <RailItem key={warning.id} messageId={`meta:warning:${warning.id}`} pathMember={false}>
              <AiChatWarningBanner warning={warning} />
            </RailItem>
          ))}

          {loading ? (
            <RailItem messageId="meta:loading" pathMember={false}>
              <div className="rounded-xl bg-app-background p-3 text-center text-xs text-ctp-subtext0">
                正在连接 AI 会话…
              </div>
            </RailItem>
          ) : null}

          {!loading && snapshot.messages.length === 0 ? (
            <RailItem messageId="meta:empty" pathMember={false}>
              <div className="px-1 py-4 text-xs text-ctp-subtext0">开始一段对话。</div>
            </RailItem>
          ) : null}

          {(() => {
            const renderMessageRow = (
              message: (typeof snapshot.messages)[number],
              messageIndex: number,
            ) => {
              const messageWarnings = warningsByMessageId.get(message.id) ?? [];
              const isLastAssistant =
                message.role === "assistant" && message.id === lastAssistantMessageId;
              const messageRetry = showTurnRetry && isLastAssistant ? onRetry : undefined;
              const fadeToken =
                activeBranchFade != null && messageIndex >= activeBranchFade.fromIndex
                  ? activeBranchFade.token
                  : null;
              return (
                <RailItem
                  key={message.id}
                  messageId={message.id}
                  turnAnchor={message.role === "user"}
                >
                  <BranchSuffixShell fadeToken={fadeToken}>
                    <AiMessageBlock
                      message={message}
                      onRetry={messageRetry}
                      retryLabel={messageRetry ? retryLabel : undefined}
                      footerAlwaysVisible={
                        isLastAssistant || (message.branch != null && message.branch.count > 1)
                      }
                      actionsDisabled={actionsDisabled}
                      onSelectBranch={
                        onSelectBranch
                          ? (branchIndex: number) => handleSelectBranch(message.id, branchIndex)
                          : undefined
                      }
                      onEditUser={
                        message.role === "user" && onEditUser
                          ? (text: string) => onEditUser(message.id, text)
                          : undefined
                      }
                    />
                    {messageWarnings.map((warning) => (
                      <AiChatWarningBanner key={warning.id} warning={warning} />
                    ))}
                  </BranchSuffixShell>
                </RailItem>
              );
            };

            const headEnd =
              lastUserMessageIndex >= 0 ? lastUserMessageIndex : snapshot.messages.length;
            const head = snapshot.messages.slice(0, headEnd);
            const lastTurn =
              lastUserMessageIndex >= 0 ? snapshot.messages.slice(lastUserMessageIndex) : [];

            return (
              <>
                {head.map((message, index) => renderMessageRow(message, index))}
                {lastTurn.length > 0 ? (
                  <div className={conversationLastTurnClass} data-chat-last-turn="">
                    {lastTurn.map((message, offset) =>
                      renderMessageRow(message, lastUserMessageIndex + offset),
                    )}
                    {turnError != null ? (
                      <RailItem
                        messageId="meta:turn-footer"
                        pathMember={false}
                        className={railItemStackClass}
                      >
                        <div className={turnErrorBannerClass}>{turnError}</div>
                      </RailItem>
                    ) : null}
                  </div>
                ) : null}
                {turnError != null && lastUserMessageIndex < 0 ? (
                  <RailItem
                    messageId="meta:turn-footer"
                    pathMember={false}
                    className={railItemStackClass}
                  >
                    <div className={turnErrorBannerClass}>{turnError}</div>
                  </RailItem>
                ) : null}
              </>
            );
          })()}
        </ChatScroller.Content>
      </ChatScroller.Viewport>

      <ChatScroller.JumpToLatest className={conversationScrollerJumpButtonClass}>
        <span aria-hidden="true" className="icon-[codicon--arrow-down] text-xs" />
        跳到最新
      </ChatScroller.JumpToLatest>
    </>
  );
}

export function AiChatConversationRail(props: AiChatConversationRailProps) {
  return (
    <ChatScroller.Root
      key={props.snapshot.conversationId}
      className={conversationScrollerRootClass}
      autoScroll
      openAt="last-anchor"
    >
      <AiChatConversationRailBody {...props} />
    </ChatScroller.Root>
  );
}
