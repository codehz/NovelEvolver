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
  shouldKeepWorkExpanded,
  type AssistantSegment,
} from "./project-assistant-segments";

type AiAssistantMessageBlockProps = {
  message: AiChatAssistantMessage;
  onRetry?: () => void;
  retryLabel?: string;
  onContinue?: () => void;
  footerAlwaysVisible?: boolean;
  actionsDisabled?: boolean;
  onSelectBranch?: (index: number) => void;
};

type SegmentRenderContext = {
  messageStreaming: boolean;
  isLastSegment: boolean;
};

function renderAssistantSegment(segment: AssistantSegment, context: SegmentRenderContext) {
  switch (segment.kind) {
    case "prose":
      return <AiAssistantPartBlock key={segment.id} part={segment.part} />;
    case "work": {
      const keepExpanded = shouldKeepWorkExpanded({
        isStepsLive: isWorkSegmentLive(segment.steps),
        messageStreaming: context.messageStreaming,
        isLastSegment: context.isLastSegment,
      });
      return (
        <AiWorkBlock
          key={segment.id}
          segmentId={segment.id}
          steps={segment.steps}
          keepExpanded={keepExpanded}
        />
      );
    }
    case "subagent":
      return <AiSubagentCard key={segment.id} toolCall={segment.part} />;
    case "ask_user":
      return <AiAskUserCard key={segment.id} toolCall={segment.part} />;
  }
}

/** True when Work / elevated cards already show live process chrome (incl. trailing hold). */
function hasVisibleLiveProcess(
  segments: readonly AssistantSegment[],
  messageStreaming: boolean,
): boolean {
  return segments.some((segment, index) => {
    if (segment.kind === "work") {
      return shouldKeepWorkExpanded({
        isStepsLive: isWorkSegmentLive(segment.steps),
        messageStreaming,
        isLastSegment: index === segments.length - 1,
      });
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

function mapAssistantSegments(segments: readonly AssistantSegment[], messageStreaming: boolean) {
  return segments.map((segment, index) =>
    renderAssistantSegment(segment, {
      messageStreaming,
      isLastSegment: index === segments.length - 1,
    }),
  );
}

export function AiAssistantMessageBlock({
  message,
  onRetry,
  retryLabel = "重新生成",
  onContinue,
  footerAlwaysVisible = false,
  actionsDisabled = false,
  onSelectBranch,
}: AiAssistantMessageBlockProps) {
  const segments = projectAssistantSegments(message.parts);
  const messageStreaming = message.status === "streaming";

  if (messageStreaming) {
    const hasStreamingPart = message.parts.some((part) => part.status === "streaming");
    const streamingMeta = describeAssistantStreamingMeta(message);
    const showStreamingMeta =
      !hasStreamingPart && !hasVisibleLiveProcess(segments, messageStreaming);
    return (
      <article className={assistantMessageBlockClass}>
        {mapAssistantSegments(segments, messageStreaming)}
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
  const hasLeading = onRetry != null || onContinue != null || showBranch;
  const alwaysVisible = footerAlwaysVisible || showBranch;

  return (
    <article className={assistantMessageBlockClass}>
      {mapAssistantSegments(segments, messageStreaming)}
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
            {onContinue ? (
              <AppTooltip label="继续会话" side="top">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="继续会话"
                  disabled={actionsDisabled}
                  className={messageActionButtonClass}
                  onClick={onContinue}
                >
                  <span aria-hidden="true" className="icon-[codicon--debug-continue] text-sm" />
                </Button>
              </AppTooltip>
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
