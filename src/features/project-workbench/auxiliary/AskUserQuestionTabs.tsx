import { cn } from "#app/shared/lib/ui/cn";
import { scrollbarThinNativeClass } from "#app/shared/lib/ui/scrollbar";
import type { AiChatToolCall } from "#shared/rpc/ai-rpc";

import { summarizeAskUserQuestion } from "./ask-user-prompt";

const tabsRailClass = cn("flex gap-1.5 overflow-x-auto px-1 pb-1", scrollbarThinNativeClass);
const tabButtonClass = cn(
  "inline-flex max-w-40 shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-left text-2xs transition-colors",
);
const tabButtonActiveClass = cn("border-ctp-blue/50 bg-app-surface text-app-foreground");
const tabButtonIdleClass = cn(
  "border-titlebar-border bg-app-background text-ctp-subtext0 hover:bg-app-surface",
);
const tabButtonAnsweredClass = cn("border-titlebar-border bg-app-background text-ctp-subtext1");

export function AskUserQuestionTabs({
  toolCalls,
  activeToolCallId,
  onSelectToolCallId,
}: {
  toolCalls: AiChatToolCall[];
  activeToolCallId: string | null;
  onSelectToolCallId: (toolCallId: string) => void;
}) {
  if (toolCalls.length <= 1) {
    return null;
  }

  return (
    <div className={tabsRailClass} role="tablist">
      {toolCalls.map((toolCall, index) => {
        const isActive = toolCall.id === activeToolCallId;
        const isAnswered = toolCall.status === "complete";
        const label = summarizeAskUserQuestion(toolCall, index);

        return (
          <button
            key={toolCall.id}
            aria-selected={isActive}
            className={cn(
              tabButtonClass,
              isActive
                ? tabButtonActiveClass
                : isAnswered
                  ? tabButtonAnsweredClass
                  : tabButtonIdleClass,
            )}
            role="tab"
            title={label}
            type="button"
            onClick={() => {
              if (!isAnswered) {
                onSelectToolCallId(toolCall.id);
              }
            }}
          >
            {isAnswered ? (
              <span aria-hidden="true" className="icon-[codicon--check] text-ctp-green" />
            ) : null}
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
