import { MessageScroller } from "@shadcn/react/message-scroller";
import { useMemo, type ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import type { AiChatSnapshot } from "#shared/rpc/ai/index";

import { AiMessageBlock } from "../messages/AiMessageBlock";
import {
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

function RailItem({
  messageId,
  scrollAnchor = false,
  className,
  children,
}: {
  messageId: string;
  scrollAnchor?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <MessageScroller.Item messageId={messageId} scrollAnchor={scrollAnchor} className={className}>
      {children}
    </MessageScroller.Item>
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
};

export function AiChatConversationRail({
  snapshot,
  loading,
  subscriptionError,
  turnError,
  onRetry,
}: AiChatConversationRailProps) {
  const { warningsByMessageId, orphanWarnings } = useMemo(
    () => groupChatWarnings(snapshot.messages, snapshot.warnings),
    [snapshot.messages, snapshot.warnings],
  );

  const showTurnRetry =
    onRetry !== undefined &&
    !snapshot.pending &&
    snapshot.pendingUserInputs.length === 0 &&
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

  const retryLabel = turnError ? "重试" : "重新生成";

  return (
    <MessageScroller.Provider
      key={snapshot.conversationId}
      autoScroll
      defaultScrollPosition="last-anchor"
    >
      <MessageScroller.Root className={conversationScrollerRootClass}>
        <MessageScroller.Viewport
          aria-label="对话消息"
          className={conversationScrollerViewportClass}
        >
          <MessageScroller.Content
            aria-busy={snapshot.pending || undefined}
            className={cn(panelSectionClass, conversationRailClass, "text-sm")}
          >
            {snapshot.scenarioId ? (
              <RailItem messageId="meta:scenario">
                <div className="text-2xs text-ctp-subtext0">
                  测试场景 · <span className="font-mono text-ctp-mauve">{snapshot.scenarioId}</span>
                </div>
              </RailItem>
            ) : null}

            {subscriptionError ? (
              <RailItem messageId="meta:subscription-error">
                <div className={turnErrorBannerClass}>{subscriptionError}</div>
              </RailItem>
            ) : null}

            {orphanWarnings.map((warning) => (
              <RailItem key={warning.id} messageId={`meta:warning:${warning.id}`}>
                <AiChatWarningBanner warning={warning} />
              </RailItem>
            ))}

            {loading ? (
              <RailItem messageId="meta:loading">
                <div className="rounded-xl bg-app-background p-3 text-center text-xs text-ctp-subtext0">
                  正在连接 AI 会话…
                </div>
              </RailItem>
            ) : null}

            {!loading && snapshot.messages.length === 0 ? (
              <RailItem messageId="meta:empty">
                <div className="px-1 py-4 text-xs text-ctp-subtext0">开始一段对话。</div>
              </RailItem>
            ) : null}

            {snapshot.messages.map((message) => {
              const messageWarnings = warningsByMessageId.get(message.id) ?? [];
              const messageRetry =
                showTurnRetry &&
                message.role === "assistant" &&
                message.id === lastAssistantMessageId
                  ? onRetry
                  : undefined;
              return (
                <RailItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={message.role === "user"}
                  className={railItemStackClass}
                >
                  <AiMessageBlock
                    message={message}
                    onRetry={messageRetry}
                    retryLabel={messageRetry ? retryLabel : undefined}
                  />
                  {messageWarnings.map((warning) => (
                    <AiChatWarningBanner key={warning.id} warning={warning} />
                  ))}
                </RailItem>
              );
            })}

            {turnError != null ? (
              <RailItem messageId="meta:turn-footer" className={railItemStackClass}>
                <div className={turnErrorBannerClass}>{turnError}</div>
              </RailItem>
            ) : null}
          </MessageScroller.Content>
        </MessageScroller.Viewport>

        <MessageScroller.Button className={conversationScrollerJumpButtonClass}>
          <span aria-hidden="true" className="icon-[codicon--arrow-down] text-xs" />
          跳到最新
        </MessageScroller.Button>
      </MessageScroller.Root>
    </MessageScroller.Provider>
  );
}
