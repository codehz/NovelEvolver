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

type AiAssistantMessageBlockProps = {
  message: AiChatAssistantMessage;
  /** When set, show retry on the completed footer leading slot (last assistant turn only). */
  onRetry?: () => void;
  /** Retry button label/aria when `onRetry` is set. */
  retryLabel?: string;
  /**
   * When true, completed footer stays visible.
   * When false, only reveal on block hover / focus-within (historical turns).
   */
  footerAlwaysVisible?: boolean;
};

export function AiAssistantMessageBlock({
  message,
  onRetry,
  retryLabel = "重新生成",
  footerAlwaysVisible = false,
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

  return (
    <article className={assistantMessageBlockClass}>
      {message.parts.map((part) => (
        <AiAssistantPartBlock key={part.id} part={part} />
      ))}
      <div
        className={cn(
          assistantMessageFooterClass,
          !footerAlwaysVisible && assistantMessageFooterHoverRevealClass,
        )}
      >
        {onRetry ? (
          <div className={assistantMessageFooterLeadingClass}>
            <AppTooltip label={retryLabel} side="top">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={retryLabel}
                className="text-ctp-mauve"
                onClick={onRetry}
              >
                <span aria-hidden="true" className="icon-[codicon--refresh] text-sm" />
              </Button>
            </AppTooltip>
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
