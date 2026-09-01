import { Menu } from "@base-ui/react/menu";
import type { AiReasoningLevel } from "@novelevolver/domain/settings/ai-settings";
import { AI_REASONING_LEVEL_LABELS } from "@novelevolver/domain/settings/ai-settings";
import { useCallback, useState } from "react";

import { cn } from "#app/shared/lib/ui/cn";

import { modelSelectorButtonClass, modelSelectorLabelClass } from "../ui/ai-chat-chrome";
import {
  reasoningMenuItemActiveClass,
  reasoningMenuItemClass,
  reasoningMenuPanelClass,
  reasoningSelectorAnchorClass,
  selectorPositionerClass,
} from "./ai-chat-selector-chrome";

type AiChatReasoningSelectorProps = {
  label: string;
  disabled: boolean;
  levels: readonly AiReasoningLevel[];
  selectedLevel: AiReasoningLevel | null;
  onSelect: (level: AiReasoningLevel) => void;
};

export function AiChatReasoningSelector({
  label,
  disabled,
  levels,
  selectedLevel,
  onSelect,
}: AiChatReasoningSelectorProps) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next && disabled) {
        return;
      }
      setOpen(next);
    },
    [disabled],
  );

  const handleSelect = useCallback(
    (level: AiReasoningLevel) => {
      setOpen(false);
      onSelect(level);
    },
    [onSelect],
  );

  return (
    <div className={reasoningSelectorAnchorClass}>
      <Menu.Root open={open} onOpenChange={handleOpenChange}>
        <Menu.Trigger
          className={modelSelectorButtonClass}
          disabled={disabled}
          aria-label="选择推理强度"
          title={label}
        >
          <span aria-hidden="true" className="icon-[codicon--lightbulb] shrink-0 text-xs" />
          <span className={modelSelectorLabelClass}>{label}</span>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner
            className={selectorPositionerClass}
            side="top"
            align="start"
            sideOffset={6}
            positionMethod="fixed"
          >
            <Menu.Popup className={reasoningMenuPanelClass}>
              {levels.map((level) => {
                const isActive = level === selectedLevel;
                return (
                  <Menu.Item
                    key={level}
                    label={AI_REASONING_LEVEL_LABELS[level]}
                    className={cn(reasoningMenuItemClass, isActive && reasoningMenuItemActiveClass)}
                    onClick={() => {
                      handleSelect(level);
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {AI_REASONING_LEVEL_LABELS[level]}
                    </span>
                    <span className="shrink-0 text-2xs text-app-muted">{level}</span>
                  </Menu.Item>
                );
              })}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}
