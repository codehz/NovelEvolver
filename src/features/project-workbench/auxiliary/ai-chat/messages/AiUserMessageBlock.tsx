import type { AiChatUserMessage } from "#shared/rpc/ai/index";

import {
  userMessageBubbleClass,
  userMessageRowClass,
  userSlashChipClass,
} from "../ui/ai-chat-chrome";
import { renderTextWithMentions } from "./render-text-with-mentions";

type AiUserMessageBlockProps = {
  message: AiChatUserMessage;
};

export function AiUserMessageBlock({ message }: AiUserMessageBlockProps) {
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
