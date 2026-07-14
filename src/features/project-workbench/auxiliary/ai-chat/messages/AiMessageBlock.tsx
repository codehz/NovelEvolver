import type { ReactNode } from "react";

import { Button, AppTooltip, MarkdownStream } from "#app/shared/ui";
import type { AiChatAssistantPart, AiChatMentionRef, AiChatMessage } from "#shared/rpc/ai/index";

import {
  assistantMessageBlockClass,
  assistantMessageBodyClass,
  assistantMessageFooterClass,
  assistantMessageFooterLeadingClass,
  assistantMessageFooterTrailingClass,
  assistantMessageModelLabelClass,
  reasoningMetaClass,
  userMentionChipClass,
  userMessageBubbleClass,
  userMessageRowClass,
  userSlashChipClass,
} from "../ui/ai-chat-chrome";
import { describeAssistantStreamingMeta, describeAssistantUsageMeta } from "../ui/ai-chat-helpers";
import { AiReasoningBlock } from "./AiReasoningBlock";
import { AiToolCallBlock } from "./AiToolCallBlock";

function AiAssistantPartBlock({ part }: { part: AiChatAssistantPart }) {
  switch (part.type) {
    case "message":
      return (
        <div className={assistantMessageBodyClass}>
          {part.text !== "" ? (
            <MarkdownStream isAnimating={part.status === "streaming"}>{part.text}</MarkdownStream>
          ) : (
            <p className="text-ctp-subtext0">...</p>
          )}
        </div>
      );
    case "reasoning":
      return <AiReasoningBlock reasoning={part} />;
    case "tool_call":
      return <AiToolCallBlock toolCall={part} />;
  }
}

function mentionTitle(mention: AiChatMentionRef): string {
  const kind =
    mention.kind === "folder"
      ? mention.domain === "manuscript"
        ? "文件夹"
        : "资源文件夹"
      : mention.kind === "chapter"
        ? "章节"
        : "资源";
  if (mention.displayPath !== "" && mention.displayPath !== mention.label) {
    return `${mention.displayPath}\n${kind}`;
  }
  return kind;
}

/**
 * Split user text on mention tokens (longest-first) and render chips for matches.
 */
function renderTextWithMentions(text: string, mentions: readonly AiChatMentionRef[]): ReactNode {
  if (mentions.length === 0 || text === "") {
    return text;
  }

  const byToken = new Map<string, AiChatMentionRef>();
  for (const mention of mentions) {
    if (mention.token !== "") {
      byToken.set(mention.token, mention);
    }
  }
  if (byToken.size === 0) {
    return text;
  }

  const tokens = [...byToken.keys()].sort((left, right) => right.length - left.length);
  const nodes: ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < text.length) {
    let matched: string | null = null;
    for (const token of tokens) {
      if (text.startsWith(token, index)) {
        matched = token;
        break;
      }
    }
    if (matched !== null) {
      const mention = byToken.get(matched);
      if (mention) {
        nodes.push(
          <span key={`m-${key++}`} className={userMentionChipClass} title={mentionTitle(mention)}>
            @{mention.label}
          </span>,
        );
      } else {
        nodes.push(matched);
      }
      index += matched.length;
      continue;
    }

    // Accumulate plain run until next potential `@` or end.
    const nextAt = text.indexOf("@", index + 1);
    const end = nextAt === -1 ? text.length : nextAt;
    nodes.push(text.slice(index, end));
    index = end;
  }

  return nodes;
}

type AiMessageBlockProps = {
  message: AiChatMessage;
  /** When set, show retry on the completed footer leading slot (last assistant turn only). */
  onRetry?: () => void;
  /** Retry button label/aria when `onRetry` is set. */
  retryLabel?: string;
};

export function AiMessageBlock({ message, onRetry, retryLabel = "重新生成" }: AiMessageBlockProps) {
  if (message.role === "user") {
    const slash = message.slash;
    const mentions = message.mentions ?? [];
    const remainder = renderTextWithMentions(message.text, mentions);
    return (
      <div className={userMessageRowClass}>
        <div className={userMessageBubbleClass}>
          {slash ? (
            <p className="whitespace-pre-wrap">
              <span
                className={userSlashChipClass}
                title={slash.title !== "" ? `${slash.title}\n${slash.body}` : slash.body}
              >
                /{slash.slug}
              </span>
              {remainder}
            </p>
          ) : (
            <p className="whitespace-pre-wrap">{remainder}</p>
          )}
        </div>
      </div>
    );
  }

  if (message.status === "streaming") {
    const streamingMeta = describeAssistantStreamingMeta(message);
    return (
      <article className={assistantMessageBlockClass}>
        {message.parts.map((part) => (
          <AiAssistantPartBlock key={part.id} part={part} />
        ))}
        <p className={reasoningMetaClass} title={streamingMeta}>
          {streamingMeta}
        </p>
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
      <div className={assistantMessageFooterClass}>
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
