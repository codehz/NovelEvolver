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
  onFork?: () => void;
  onEditUser?: (text: string) => void;
  onSelectBranch?: (index: number) => void;
};

export const AiMessageBlock = memo(function AiMessageBlock({
  message,
  onRetry,
  retryLabel,
  footerAlwaysVisible,
  actionsDisabled,
  onFork,
  onEditUser,
  onSelectBranch,
}: AiMessageBlockProps) {
  if (message.role === "user") {
    return (
      <AiUserMessageBlock
        message={message}
        actionsDisabled={actionsDisabled}
        onFork={onFork}
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
      onFork={onFork}
      onSelectBranch={onSelectBranch}
    />
  );
});
