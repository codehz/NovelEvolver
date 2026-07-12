import type { AiChatWarning } from "#shared/rpc/ai/index";

import { warningBannerClass } from "../ui/ai-chat-ui";

export function AiChatWarningBanner({ warning }: { warning: AiChatWarning }) {
  return (
    <div className={warningBannerClass}>
      {warning.code ? <span className="font-mono">{warning.code}: </span> : null}
      {warning.message}
    </div>
  );
}
