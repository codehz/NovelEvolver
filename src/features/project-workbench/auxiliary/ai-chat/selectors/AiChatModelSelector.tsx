import { Popover } from "@base-ui/react/popover";
import { useCallback, useState } from "react";

import { modelSelectorButtonClass, modelSelectorLabelClass } from "../ui/ai-chat-chrome";
import {
  modelSelectorAnchorClass,
  selectorPopoverPanelClass,
  selectorPositionerClass,
} from "./ai-chat-selector-chrome";
import { AnchoredSelectorPicker } from "./AnchoredSelectorPicker";
import type { AiChatSelectorItem } from "./selector-items";

type AiChatModelSelectorProps = {
  label: string;
  disabled: boolean;
  items: readonly AiChatSelectorItem[];
  onOpen?: () => void;
  onSelect: (id: string) => void;
};

export function AiChatModelSelector({
  label,
  disabled,
  items,
  onOpen,
  onSelect,
}: AiChatModelSelectorProps) {
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
    <div className={modelSelectorAnchorClass}>
      <Popover.Root open={open} onOpenChange={handleOpenChange}>
        <Popover.Trigger
          className={modelSelectorButtonClass}
          disabled={disabled}
          aria-label="选择模型"
          title={label}
        >
          <span aria-hidden="true" className="icon-[codicon--sparkle] shrink-0 text-xs" />
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
                title="选择模型"
                searchLabel="搜索模型"
                searchPlaceholder="按名称或提供商筛选…"
                emptyMessage="没有可用模型，请先在设置中添加"
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
