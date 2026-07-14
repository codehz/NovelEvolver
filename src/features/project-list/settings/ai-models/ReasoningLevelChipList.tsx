import { cn } from "#app/shared/lib/ui/cn";
import type { AiReasoningLevel } from "#shared/rpc/services/index";
import { AI_REASONING_LEVEL_LABELS, AI_REASONING_LEVELS } from "#shared/rpc/services/index";

import {
  settingsChipBodyButtonClass,
  settingsChipClass,
  settingsChipDefaultClass,
  settingsChipListClass,
  settingsChipSelectedClass,
  settingsChipStarActiveClass,
  settingsChipStarButtonClass,
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

/**
 * Pill chip list for reasoning effort: body toggles availability;
 * star (selected only) sets the default. Non-empty available always has a default.
 */
export function ReasoningLevelChipList({
  available,
  defaultLevel,
  disabled = false,
  onChange,
}: ReasoningLevelChipListProps) {
  const availableSet = new Set(available);

  const emit = (nextAvailable: AiReasoningLevel[], nextDefault: AiReasoningLevel | null) => {
    onChange({ available: nextAvailable, defaultLevel: nextDefault });
  };

  const toggleLevel = (level: AiReasoningLevel) => {
    if (disabled) {
      return;
    }
    const nextSet = new Set(available);
    if (nextSet.has(level)) {
      nextSet.delete(level);
    } else {
      nextSet.add(level);
    }
    const nextAvailable = orderReasoningLevels([...nextSet]);
    const nextDefault = resolveDefaultAfterAvailableChange(nextAvailable, defaultLevel);
    emit(nextAvailable, nextDefault);
  };

  const setDefault = (level: AiReasoningLevel) => {
    if (disabled || !availableSet.has(level) || defaultLevel === level) {
      return;
    }
    emit([...available], level);
  };

  return (
    <div className={settingsChipListClass} role="group" aria-label="Reasoning Effort 档位">
      {AI_REASONING_LEVELS.map((level) => {
        const isSelected = availableSet.has(level);
        const isDefault = isSelected && defaultLevel === level;
        return (
          <div
            key={level}
            className={cn(
              settingsChipClass,
              isSelected && settingsChipSelectedClass,
              isDefault && settingsChipDefaultClass,
              disabled && "opacity-50",
            )}
          >
            <button
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              className={settingsChipBodyButtonClass}
              onClick={() => {
                toggleLevel(level);
              }}
            >
              <span className="font-medium">{AI_REASONING_LEVEL_LABELS[level]}</span>
              <span className={cn("text-app-muted", isDefault && "text-badge-background/80")}>
                {level}
              </span>
            </button>
            {isSelected ? (
              <button
                type="button"
                disabled={disabled || isDefault}
                aria-label={
                  isDefault ? "当前默认" : `设 ${AI_REASONING_LEVEL_LABELS[level]} 为默认`
                }
                aria-pressed={isDefault}
                className={cn(
                  settingsChipStarButtonClass,
                  isDefault && settingsChipStarActiveClass,
                )}
                onClick={() => {
                  setDefault(level);
                }}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "leading-none",
                    isDefault ? "icon-[codicon--star-full]" : "icon-[codicon--star-empty]",
                  )}
                />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
