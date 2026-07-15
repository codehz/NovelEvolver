import { MarkdownStream } from "#app/shared/ui";
import type { AiChatAssistantPart } from "#shared/rpc/ai/index";

import { assistantMessageBodyClass } from "../ui/ai-chat-chrome";
import { AiReasoningBlock } from "./AiReasoningBlock";
import { AiToolCallBlock } from "./AiToolCallBlock";

type AiAssistantPartBlockProps = {
  part: AiChatAssistantPart;
};

export function AiAssistantPartBlock({ part }: AiAssistantPartBlockProps) {
  switch (part.type) {
    case "message":
      return (
        <div className={assistantMessageBodyClass}>
          {part.text !== "" ? (
            <MarkdownStream isAnimating={part.status === "streaming"}>{part.text}</MarkdownStream>
          ) : (
            <span
              aria-hidden="true"
              className="icon-[codicon--loading] animate-spin text-sm text-ctp-subtext0"
            />
          )}
        </div>
      );
    case "reasoning":
      return <AiReasoningBlock reasoning={part} />;
    case "tool_call":
      return <AiToolCallBlock toolCall={part} />;
  }
}
