import type { AiChatWarning } from "#domain/ai";

import { warningBannerClass } from "../ui/ai-chat-chrome";

type AiChatWarningBannerProps = { warning: AiChatWarning };

export function AiChatWarningBanner({ warning }: AiChatWarningBannerProps) {
  return (
    <div className={warningBannerClass}>
      {warning.code ? <span className="font-mono">{warning.code}: </span> : null}
      {warning.message}
    </div>
  );
}
