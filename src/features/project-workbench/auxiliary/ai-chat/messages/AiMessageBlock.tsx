import { MarkdownStream } from "#app/shared/ui";
import type { AiChatAssistantPart, AiChatMessage } from "#shared/rpc/ai/index";

import {
  assistantMessageBlockClass,
  assistantMessageBodyClass,
  reasoningMetaClass,
  userMessageBubbleClass,
  userMessageRowClass,
} from "../ui/ai-chat-chrome";
import { describeAssistantMessageMeta } from "../ui/ai-chat-helpers";
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

type AiMessageBlockProps = { message: AiChatMessage };

export function AiMessageBlock({ message }: AiMessageBlockProps) {
  if (message.role === "user") {
    return (
      <div className={userMessageRowClass}>
        <div className={userMessageBubbleClass}>
          <p className="whitespace-pre-wrap">{message.text}</p>
        </div>
      </div>
    );
  }

  const metaText = describeAssistantMessageMeta(message);

  return (
    <article className={assistantMessageBlockClass}>
      {message.parts.length > 0 ? (
        message.parts.map((part) => <AiAssistantPartBlock key={part.id} part={part} />)
      ) : (
        <div className={assistantMessageBodyClass}>
          <p className="text-ctp-subtext0">
            {message.status === "streaming" ? "思考中..." : "未生成正文。"}
          </p>
        </div>
      )}

      {metaText !== "" ? (
        <p className={reasoningMetaClass} title={metaText}>
          {metaText}
        </p>
      ) : null}
    </article>
  );
}
