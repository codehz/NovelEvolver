import type { AiChatMessage } from "#shared/rpc/ai/index";

import { AiAssistantMessageBlock } from "./AiAssistantMessageBlock";
import { AiUserMessageBlock } from "./AiUserMessageBlock";

type AiMessageBlockProps = {
  message: AiChatMessage;
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

export function AiMessageBlock({
  message,
  onRetry,
  retryLabel,
  footerAlwaysVisible,
}: AiMessageBlockProps) {
  if (message.role === "user") {
    return <AiUserMessageBlock message={message} />;
  }

  return (
    <AiAssistantMessageBlock
      message={message}
      onRetry={onRetry}
      retryLabel={retryLabel}
      footerAlwaysVisible={footerAlwaysVisible}
    />
  );
}
