import { Popover } from "@base-ui/react/popover";
import { useCallback, useState } from "react";

import { agentSelectorButtonClass, modelSelectorLabelClass } from "../ui/ai-chat-ui";
import {
  agentSelectorAnchorClass,
  selectorPopoverPanelClass,
  selectorPositionerClass,
} from "./ai-chat-selector-chrome";
import { AnchoredSelectorPicker } from "./AnchoredSelectorPicker";
import type { AiChatSelectorItem } from "./selector-items";

export function AiChatAgentSelector({
  label,
  disabled,
  items,
  onOpen,
  onSelect,
}: {
  label: string;
  disabled: boolean;
  items: readonly AiChatSelectorItem[];
  onOpen?: () => void;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        if (disabled) {
          return;
        }
        onOpen?.();
      }
      setOpen(next);
    },
    [disabled, onOpen],
  );

  const handleSelect = useCallback(
    (id: string) => {
      setOpen(false);
      onSelect(id);
    },
    [onSelect],
  );

  return (
    <div className={agentSelectorAnchorClass}>
      <Popover.Root open={open} onOpenChange={handleOpenChange}>
        <Popover.Trigger
          className={agentSelectorButtonClass}
          disabled={disabled}
          aria-label="选择 Agent"
          title={label}
        >
          <span aria-hidden="true" className="icon-[codicon--hubot] shrink-0 text-xs" />
          <span className={modelSelectorLabelClass}>{label}</span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            className={selectorPositionerClass}
            side="top"
            align="start"
            sideOffset={6}
            positionMethod="fixed"
          >
            <Popover.Popup className={selectorPopoverPanelClass}>
              <AnchoredSelectorPicker
                title="选择 Agent"
                searchLabel="搜索 Agent"
                searchPlaceholder="按名称筛选…"
                emptyMessage="没有可用 Agent"
                items={items}
                open={open}
                onOpenChange={handleOpenChange}
                onSelect={handleSelect}
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
