import { AppTooltip, Button } from "#app/shared/ui";
import type { AiChatMessageContinuation } from "#shared/rpc/ai/index";

import { AiMessageBranchSwitcher } from "./AiMessageBranchSwitcher";

type AiMessageContinuationControlProps = {
  continuation: AiChatMessageContinuation;
  disabled?: boolean;
  onSelect: (index: number) => void;
};

/**
 * Controls for a truncated leaf with retained child continuations.
 * Restore always targets preferredIndex (last selected before fork).
 * When count > 1, ‹ n/m › immediately reattaches the chosen child.
 */
export function AiMessageContinuationControl({
  continuation,
  disabled = false,
  onSelect,
}: AiMessageContinuationControlProps) {
  if (continuation.count <= 0) {
    return null;
  }

  const preferredIndex = Math.min(Math.max(continuation.preferredIndex, 0), continuation.count - 1);

  return (
    <>
      {continuation.count > 1 ? (
        <AiMessageBranchSwitcher
          branch={{ index: preferredIndex, count: continuation.count }}
          disabled={disabled}
          onSelect={onSelect}
        />
      ) : null}
      <AppTooltip label="恢复后续消息" side="top">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="恢复后续"
          disabled={disabled}
          className="text-ctp-subtext1"
          onClick={() => {
            onSelect(preferredIndex);
          }}
        >
          <span aria-hidden="true" className="icon-[codicon--debug-step-over] text-sm" />
        </Button>
      </AppTooltip>
    </>
  );
}
