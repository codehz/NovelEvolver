import { memo } from "react";

import type { AiChatMessage } from "#shared/rpc/ai/index";

import { AiAssistantMessageBlock } from "./AiAssistantMessageBlock";
import { AiUserMessageBlock } from "./AiUserMessageBlock";

type AiMessageBlockProps = {
  message: AiChatMessage;
  onRetry?: () => void;
  retryLabel?: string;
  footerAlwaysVisible?: boolean;
  actionsDisabled?: boolean;
  onEditUser?: (text: string) => void;
  onSelectBranch?: (index: number) => void;
};

export const AiMessageBlock = memo(function AiMessageBlock({
  message,
  onRetry,
  retryLabel,
  footerAlwaysVisible,
  actionsDisabled,
  onEditUser,
  onSelectBranch,
}: AiMessageBlockProps) {
  if (message.role === "user") {
    return (
      <AiUserMessageBlock
        message={message}
        actionsDisabled={actionsDisabled}
        onEdit={onEditUser}
        onSelectBranch={onSelectBranch}
      />
    );
  }

  return (
    <AiAssistantMessageBlock
      message={message}
      onRetry={onRetry}
      retryLabel={retryLabel}
      footerAlwaysVisible={footerAlwaysVisible}
      actionsDisabled={actionsDisabled}
      onSelectBranch={onSelectBranch}
    />
  );
});
