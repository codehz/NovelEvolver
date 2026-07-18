import { AppTooltip, Button } from "#app/shared/ui";
import type { AiChatMessageBranch } from "#shared/rpc/ai/index";

import {
  messageActionButtonClass,
  messageBranchLabelClass,
  messageBranchSwitcherClass,
} from "../ui/ai-chat-chrome";

type AiMessageBranchSwitcherProps = {
  branch: AiChatMessageBranch;
  disabled?: boolean;
  onSelect: (index: number) => void;
};

export function AiMessageBranchSwitcher({
  branch,
  disabled = false,
  onSelect,
}: AiMessageBranchSwitcherProps) {
  if (branch.count <= 1) {
    return null;
  }

  const canPrev = branch.index > 0;
  const canNext = branch.index < branch.count - 1;
  const label = `${branch.index + 1}/${branch.count}`;

  return (
    <div className={messageBranchSwitcherClass} role="group" aria-label="消息分支">
      <AppTooltip label="上一个分支" side="top">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="上一个分支"
          className={messageActionButtonClass}
          disabled={disabled || !canPrev}
          onClick={() => {
            if (canPrev) {
              onSelect(branch.index - 1);
            }
          }}
        >
          <span aria-hidden="true" className="icon-[codicon--chevron-left] text-sm" />
        </Button>
      </AppTooltip>
      <span className={messageBranchLabelClass}>{label}</span>
      <AppTooltip label="下一个分支" side="top">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="下一个分支"
          className={messageActionButtonClass}
          disabled={disabled || !canNext}
          onClick={() => {
            if (canNext) {
              onSelect(branch.index + 1);
            }
          }}
        >
          <span aria-hidden="true" className="icon-[codicon--chevron-right] text-sm" />
        </Button>
      </AppTooltip>
    </div>
  );
}
