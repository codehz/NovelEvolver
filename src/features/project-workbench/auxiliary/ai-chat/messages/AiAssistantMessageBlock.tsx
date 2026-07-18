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
  reasoningMetaClass,
} from "../ui/ai-chat-chrome";
import { describeAssistantStreamingMeta, describeAssistantUsageMeta } from "../ui/ai-chat-helpers";
import { AiAssistantPartBlock } from "./AiAssistantPartBlock";
import { AiMessageBranchSwitcher } from "./AiMessageBranchSwitcher";

type AiAssistantMessageBlockProps = {
  message: AiChatAssistantMessage;
  onRetry?: () => void;
  retryLabel?: string;
  footerAlwaysVisible?: boolean;
  actionsDisabled?: boolean;
  onSelectBranch?: (index: number) => void;
};

export function AiAssistantMessageBlock({
  message,
  onRetry,
  retryLabel = "重新生成",
  footerAlwaysVisible = false,
  actionsDisabled = false,
  onSelectBranch,
}: AiAssistantMessageBlockProps) {
  if (message.status === "streaming") {
    const hasStreamingPart = message.parts.some((part) => part.status === "streaming");
    const streamingMeta = describeAssistantStreamingMeta(message);
    return (
      <article className={assistantMessageBlockClass}>
        {message.parts.map((part) => (
          <AiAssistantPartBlock key={part.id} part={part} />
        ))}
        {!hasStreamingPart ? (
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
      {message.parts.map((part) => (
        <AiAssistantPartBlock key={part.id} part={part} />
      ))}
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
                  className="text-ctp-mauve"
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
