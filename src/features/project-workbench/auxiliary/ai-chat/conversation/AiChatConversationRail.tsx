import { useEffect, useMemo, useRef } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { ScrollArea } from "#app/shared/ui/ScrollArea";
import type { AiChatSnapshot } from "#shared/rpc/ai/index";

import { AiMessageBlock } from "../messages/AiMessageBlock";
import { conversationRailClass, panelSectionClass } from "../ui/ai-chat-ui";
import { groupChatWarnings } from "../ui/group-chat-warnings";
import { AiChatWarningBanner } from "./AiChatWarningBanner";

export function AiChatConversationRail({
  snapshot,
  loading,
  errorMessage,
}: {
  snapshot: AiChatSnapshot;
  loading: boolean;
  errorMessage: string | null;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const { warningsByMessageId, orphanWarnings } = useMemo(
    () => groupChatWarnings(snapshot.messages, snapshot.warnings),
    [snapshot.messages, snapshot.warnings],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [snapshot.messages, snapshot.pending, snapshot.pendingUserInputs]);

  return (
    <ScrollArea className="min-h-0 flex-1" fill>
      <div className={cn(panelSectionClass, conversationRailClass, "text-sm")}>
        {snapshot.scenarioId ? (
          <div className="text-2xs text-ctp-subtext0">
            测试场景 · <span className="font-mono text-ctp-mauve">{snapshot.scenarioId}</span>
          </div>
        ) : null}
        {errorMessage ? (
          <div className="rounded-xl border border-ctp-red/40 bg-ctp-red/10 px-3 py-2 text-xs text-ctp-red">
            {errorMessage}
          </div>
        ) : null}

        {orphanWarnings.map((warning) => (
          <AiChatWarningBanner key={warning.id} warning={warning} />
        ))}

        {loading ? (
          <div className="rounded-xl bg-app-background p-3 text-center text-xs text-ctp-subtext0">
            正在连接 AI 会话…
          </div>
        ) : null}

        {!loading && snapshot.messages.length === 0 ? (
          <div className="px-1 py-4 text-xs text-ctp-subtext0">开始一段对话。</div>
        ) : null}

        {snapshot.messages.map((message) => {
          const messageWarnings = warningsByMessageId.get(message.id) ?? [];
          return (
            <div className="flex flex-col gap-2" key={message.id}>
              <AiMessageBlock message={message} />
              {messageWarnings.map((warning) => (
                <AiChatWarningBanner key={warning.id} warning={warning} />
              ))}
            </div>
          );
        })}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-0"
          ref={endRef}
        />
      </div>
    </ScrollArea>
  );
}
