import { MarkdownStream } from "#app/shared/ui";
import type { AiChatMessagePart } from "#shared/rpc/ai/index";

import { assistantMessageBodyClass } from "../ui/ai-chat-chrome";

type AiAssistantPartBlockProps = {
  /** Prose only — work / subagent / ask_user use dedicated segment cards. */
  part: AiChatMessagePart;
};

export function AiAssistantPartBlock({ part }: AiAssistantPartBlockProps) {
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
}
