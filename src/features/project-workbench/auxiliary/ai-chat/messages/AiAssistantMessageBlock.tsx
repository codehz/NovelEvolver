import { cn } from "#app/shared/lib/ui/cn";
import { AppTooltip, Button } from "#app/shared/ui";
import type { AiChatAssistantMessage } from "#shared/rpc/ai/index";

import {
  assistantMessageBlockClass,
  assistantMessageFooterClass,
  assistantMessageFooterHoverRevealClass,
  assistantMessageFooterLeadingClass,
  assistantMessageFooterTrailingClass,
  assistantMessageModelLabelClass,
  messageActionButtonClass,
  reasoningMetaClass,
} from "../ui/ai-chat-chrome";
import { describeAssistantStreamingMeta, describeAssistantUsageMeta } from "../ui/ai-chat-helpers";
import { AiAskUserCard } from "./AiAskUserCard";
import { AiAssistantPartBlock } from "./AiAssistantPartBlock";
import { AiMessageBranchSwitcher } from "./AiMessageBranchSwitcher";
import { AiSubagentCard } from "./AiSubagentCard";
import { AiWorkBlock } from "./AiWorkBlock";
import {
  isWorkSegmentLive,
  projectAssistantSegments,
  type AssistantSegment,
} from "./project-assistant-segments";

type AiAssistantMessageBlockProps = {
  message: AiChatAssistantMessage;
  onRetry?: () => void;
  retryLabel?: string;
  footerAlwaysVisible?: boolean;
  actionsDisabled?: boolean;
  onSelectBranch?: (index: number) => void;
};

function renderAssistantSegment(segment: AssistantSegment) {
  switch (segment.kind) {
    case "prose":
      return <AiAssistantPartBlock key={segment.id} part={segment.part} />;
    case "work":
      return <AiWorkBlock key={segment.id} segmentId={segment.id} steps={segment.steps} />;
    case "subagent":
      return <AiSubagentCard key={segment.id} toolCall={segment.part} />;
    case "ask_user":
      return <AiAskUserCard key={segment.id} toolCall={segment.part} />;
  }
}

/** True when Work / elevated cards already show live process chrome. */
function hasVisibleLiveProcess(segments: readonly AssistantSegment[]): boolean {
  return segments.some((segment) => {
    if (segment.kind === "work") {
      return isWorkSegmentLive(segment.steps);
    }
    if (segment.kind === "subagent" || segment.kind === "ask_user") {
      return (
        segment.part.status === "pending" ||
        segment.part.status === "running" ||
        segment.part.status === "awaiting_user"
      );
    }
    return false;
  });
}

export function AiAssistantMessageBlock({
  message,
  onRetry,
  retryLabel = "重新生成",
  footerAlwaysVisible = false,
  actionsDisabled = false,
  onSelectBranch,
}: AiAssistantMessageBlockProps) {
  const segments = projectAssistantSegments(message.parts);

  if (message.status === "streaming") {
    const hasStreamingPart = message.parts.some((part) => part.status === "streaming");
    const streamingMeta = describeAssistantStreamingMeta(message);
    const showStreamingMeta = !hasStreamingPart && !hasVisibleLiveProcess(segments);
    return (
      <article className={assistantMessageBlockClass}>
        {segments.map(renderAssistantSegment)}
        {showStreamingMeta ? (
          <p className={reasoningMetaClass} title={streamingMeta}>
            {streamingMeta}
          </p>
        ) : null}
      </article>
    );
  }

  const modelLabel = message.modelName.trim() !== "" ? message.modelName : "未知模型";
  const usageMeta = describeAssistantUsageMeta(message);
  const branch = message.branch;
  const showBranch = branch != null && branch.count > 1;
  const hasLeading = onRetry != null || showBranch;
  const alwaysVisible = footerAlwaysVisible || showBranch;

  return (
    <article className={assistantMessageBlockClass}>
      {segments.map(renderAssistantSegment)}
      <div
        className={cn(
          assistantMessageFooterClass,
          !alwaysVisible && assistantMessageFooterHoverRevealClass,
        )}
      >
        {hasLeading ? (
          <div className={cn(assistantMessageFooterLeadingClass, "gap-0.5")}>
            {showBranch ? (
              <AiMessageBranchSwitcher
                branch={branch}
                disabled={actionsDisabled || onSelectBranch == null}
                onSelect={(index) => {
                  onSelectBranch?.(index);
                }}
              />
            ) : null}
            {onRetry ? (
              <AppTooltip label={retryLabel} side="top">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={retryLabel}
                  disabled={actionsDisabled}
                  className={messageActionButtonClass}
                  onClick={onRetry}
                >
                  <span aria-hidden="true" className="icon-[codicon--refresh] text-sm" />
                </Button>
              </AppTooltip>
            ) : null}
          </div>
        ) : null}
        <div className={assistantMessageFooterTrailingClass}>
          <AppTooltip label={usageMeta} side="top">
            <span tabIndex={0} className={assistantMessageModelLabelClass}>
              {modelLabel}
            </span>
          </AppTooltip>
        </div>
      </div>
    </article>
  );
}
