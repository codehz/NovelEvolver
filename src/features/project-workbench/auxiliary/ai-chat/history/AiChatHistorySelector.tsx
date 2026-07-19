import { Popover } from "@base-ui/react/popover";
import { useCallback, useState } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { AppTooltip } from "#app/shared/ui";
import { sidebarHeaderActionClass, sidebarHeaderIconClass } from "#workbench/chrome";

import { historyPopoverPanelClass, historyPositionerClass } from "./ai-chat-history-chrome";
import { AiChatHistoryPanel } from "./AiChatHistoryPanel";
import { useAiChatHistoryList } from "./use-ai-chat-history-list";

type AiChatHistorySelectorProps = {
  disabled: boolean;
  onClearDraft: () => void;
};

export function AiChatHistorySelector({ disabled, onClearDraft }: AiChatHistorySelectorProps) {
  const [open, setOpen] = useState(false);
  const onClose = useCallback(() => {
    setOpen(false);
  }, []);

  const list = useAiChatHistoryList({
    open,
    onClose,
    onClearDraft,
  });

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next && disabled) {
        return;
      }
      if (!next && list.shouldSuppressDismiss()) {
        return;
      }
      if (!next && list.renamingId != null) {
        void list.commitRename();
      }
      setOpen(next);
    },
    [disabled, list.commitRename, list.renamingId, list.shouldSuppressDismiss],
  );

  const handleOpenChangeComplete = useCallback(
    (next: boolean) => {
      if (!next) {
        list.resetClosedState();
      }
    },
    [list.resetClosedState],
  );

  return (
    <Popover.Root
      open={open}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={handleOpenChangeComplete}
    >
      <AppTooltip label="历史会话" side="bottom">
        <Popover.Trigger
          className={sidebarHeaderActionClass}
          disabled={disabled}
          aria-label="历史会话"
          type="button"
        >
          <span
            aria-hidden="true"
            className={cn(sidebarHeaderIconClass, "icon-[codicon--history]")}
          />
        </Popover.Trigger>
      </AppTooltip>
      <Popover.Portal>
        <Popover.Positioner
          className={historyPositionerClass}
          side="bottom"
          align="end"
          sideOffset={6}
          positionMethod="fixed"
        >
          <Popover.Popup
            className={historyPopoverPanelClass}
            initialFocus={false}
            finalFocus={false}
          >
            <AiChatHistoryPanel list={list} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
