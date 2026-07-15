import { Popover } from "@base-ui/react/popover";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";

import { cn } from "#app/shared/lib/ui/cn";
import { disabledSurfaceClass } from "#app/shared/lib/ui/interaction-chrome";
import type { AiReasoningLevel } from "#shared/rpc/services/index";
import { AI_REASONING_LEVEL_LABELS, AI_REASONING_LEVELS } from "#shared/rpc/services/index";

import {
  settingsChipClass,
  settingsChipDefaultButtonClass,
  settingsChipDefaultClass,
  settingsChipListClass,
  settingsChipPopoverPanelClass,
  settingsChipPopoverPositionerClass,
  settingsChipSelectedClass,
} from "../settings-chrome";

type ReasoningLevelChipListProps = {
  available: readonly AiReasoningLevel[];
  defaultLevel: AiReasoningLevel | null;
  disabled?: boolean;
  onChange: (next: {
    available: AiReasoningLevel[];
    defaultLevel: AiReasoningLevel | null;
  }) => void;
};

/** Keep AI_REASONING_LEVELS order when toggling multi-select. */
function orderReasoningLevels(levels: readonly string[]): AiReasoningLevel[] {
  const selected = new Set(levels);
  return AI_REASONING_LEVELS.filter((level) => selected.has(level));
}

function resolveDefaultAfterAvailableChange(
  available: readonly AiReasoningLevel[],
  previousDefault: AiReasoningLevel | null,
): AiReasoningLevel | null {
  if (available.length === 0) {
    return null;
  }
  if (previousDefault != null && available.includes(previousDefault)) {
    return previousDefault;
  }
  return available[0]!;
}

type ReasoningLevelChipProps = {
  level: AiReasoningLevel;
  isSelected: boolean;
  isDefault: boolean;
  disabled: boolean;
  onSetDefault: () => void;
};

/**
 * One reasoning level: ToggleGroup item for availability; hover Popover sets default.
 */
function ReasoningLevelChip({
  level,
  isSelected,
  isDefault,
  disabled,
  onSetDefault,
}: ReasoningLevelChipProps) {
  const label = AI_REASONING_LEVEL_LABELS[level];

  return (
    <Popover.Root
      onOpenChange={(open, details) => {
        // Hover-only affordance; ignore click-open and unselected chips.
        if (open && (!isSelected || disabled || details.reason === "trigger-press")) {
          details.cancel();
        }
      }}
    >
      <Popover.Trigger
        openOnHover
        delay={180}
        closeDelay={120}
        disabled={disabled}
        render={
          <Toggle
            value={level}
            className={cn(
              settingsChipClass,
              isSelected && settingsChipSelectedClass,
              isDefault && settingsChipDefaultClass,
              disabled && disabledSurfaceClass,
            )}
          />
        }
      >
        <span className="font-medium">{label}</span>
        <span className={cn("text-app-muted", isDefault && "text-badge-background/80")}>
          {level}
        </span>
        {isDefault ? (
          <span
            aria-hidden="true"
            className="icon-[codicon--star-full] text-[10px] leading-none text-badge-background"
          />
        ) : null}
      </Popover.Trigger>

      {isSelected ? (
        <Popover.Portal>
          <Popover.Positioner
            className={settingsChipPopoverPositionerClass}
            side="top"
            align="center"
            sideOffset={6}
            positionMethod="fixed"
          >
            <Popover.Popup
              className={settingsChipPopoverPanelClass}
              initialFocus={false}
              finalFocus={false}
            >
              {/* Plain button: nested Toggle would inherit outer ToggleGroup context. */}
              <button
                type="button"
                disabled={disabled || isDefault}
                aria-pressed={isDefault}
                aria-label={isDefault ? `${label} 为当前默认` : `设 ${label} 为默认`}
                className={cn(settingsChipDefaultButtonClass, isDefault && "text-badge-background")}
                onClick={() => {
                  onSetDefault();
                }}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "text-[10px] leading-none",
                    isDefault ? "icon-[codicon--star-full]" : "icon-[codicon--star-empty]",
                  )}
                />
                <span>{isDefault ? "默认" : "设为默认"}</span>
              </button>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      ) : null}
    </Popover.Root>
  );
}

/**
 * ToggleGroup multi-select for exposed reasoning levels; hover Popover sets default.
 * Non-empty available always has a default.
 */
export function ReasoningLevelChipList({
  available,
  defaultLevel,
  disabled = false,
  onChange,
}: ReasoningLevelChipListProps) {
  return (
    <ToggleGroup
      multiple
      disabled={disabled}
      value={available}
      aria-label="Reasoning Effort 档位"
      className={settingsChipListClass}
      onValueChange={(next) => {
        const nextAvailable = orderReasoningLevels(next);
        const nextDefault = resolveDefaultAfterAvailableChange(nextAvailable, defaultLevel);
        onChange({ available: nextAvailable, defaultLevel: nextDefault });
      }}
    >
      {AI_REASONING_LEVELS.map((level) => {
        const isSelected = available.includes(level);
        const isDefault = isSelected && defaultLevel === level;
        return (
          <ReasoningLevelChip
            key={level}
            level={level}
            isSelected={isSelected}
            isDefault={isDefault}
            disabled={disabled}
            onSetDefault={() => {
              if (!isSelected || defaultLevel === level) {
                return;
              }
              onChange({ available: [...available], defaultLevel: level });
            }}
          />
        );
      })}
    </ToggleGroup>
  );
}
