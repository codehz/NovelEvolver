import { MarkdownStream } from "#app/shared/ui/MarkdownStream";
import type { AiChatAssistantPart, AiChatMessage } from "#shared/rpc/ai-rpc";

import {
  assistantMessageBlockClass,
  assistantMessageBodyClass,
  describeAssistantMessageMeta,
  reasoningMetaClass,
  userMessageBubbleClass,
  userMessageRowClass,
} from "./ai-chat-ui";
import { AiReasoningBlock } from "./AiReasoningBlock";
import { AiToolCallBlock } from "./AiToolCallBlock";

function AiAssistantPartBlock({
  part,
  awaitingAskUserToolCallIds,
  activeAskUserToolCallId,
  onSelectAskUserToolCall,
}: {
  part: AiChatAssistantPart;
  awaitingAskUserToolCallIds: string[];
  activeAskUserToolCallId: string | null;
  onSelectAskUserToolCall: (toolCallId: string) => void;
}) {
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
      return (
        <AiToolCallBlock
          activeAskUserToolCallId={activeAskUserToolCallId}
          awaitingAskUserToolCallIds={awaitingAskUserToolCallIds}
          toolCall={part}
          onSelectAskUserToolCall={onSelectAskUserToolCall}
        />
      );
  }
}

export function AiMessageBlock({
  message,
  awaitingAskUserToolCallIds,
  activeAskUserToolCallId,
  onSelectAskUserToolCall,
}: {
  message: AiChatMessage;
  awaitingAskUserToolCallIds: string[];
  activeAskUserToolCallId: string | null;
  onSelectAskUserToolCall: (toolCallId: string) => void;
}) {
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
        message.parts.map((part) => (
          <AiAssistantPartBlock
            key={part.id}
            activeAskUserToolCallId={activeAskUserToolCallId}
            awaitingAskUserToolCallIds={awaitingAskUserToolCallIds}
            part={part}
            onSelectAskUserToolCall={onSelectAskUserToolCall}
          />
        ))
      ) : (
        <div className={assistantMessageBodyClass}>
          <p className="text-ctp-subtext0">思考中...</p>
        </div>
      )}

      <p className={reasoningMetaClass} title={metaText}>
        {metaText}
      </p>
    </article>
  );
}
