import { CheckboxGroup } from "@base-ui/react/checkbox-group";
import type { AiAgentTool } from "@novelevolver/domain/settings/ai-settings";

import { cn } from "#app/shared/lib/ui/cn";
import { Button } from "#app/shared/ui";

import {
  settingsToolCardBodyClass,
  settingsToolCardClass,
  settingsToolCardDescriptionClass,
  settingsToolCardListClass,
  settingsToolCardSelectedClass,
  settingsToolCardTitleClass,
  settingsToolPickerActionsClass,
  settingsToolPickerCountClass,
  settingsToolPickerToolbarClass,
} from "../settings-chrome";
import { SettingsCheckbox } from "../SettingsCheckbox";

type AiAgentToolPickerProps = {
  tools: AiAgentTool[];
  value: string[];
  disabled?: boolean;
  readOnly?: boolean;
  onChange: (next: string[]) => void;
};

export function AiAgentToolPicker({
  tools,
  value,
  disabled = false,
  readOnly = false,
  onChange,
}: AiAgentToolPickerProps) {
  const selectedSet = new Set(value);
  const total = tools.length;
  const selectedCount = tools.reduce(
    (count, tool) => count + (selectedSet.has(tool.name) ? 1 : 0),
    0,
  );
  const allSelected = total > 0 && selectedCount === total;
  const noneSelected = selectedCount === 0;
  const interactive = !disabled && !readOnly;

  if (total === 0) {
    return <p className={settingsToolPickerCountClass}>暂无可用工具。</p>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className={settingsToolPickerToolbarClass}>
        <span className={settingsToolPickerCountClass}>
          已选 {selectedCount} / {total}
        </span>
        {readOnly ? null : (
          <div className={settingsToolPickerActionsClass}>
            <Button
              variant="text"
              size="sm"
              className="px-1.5 py-0.5 text-2xs"
              disabled={!interactive || allSelected}
              onClick={() => {
                onChange(tools.map((tool) => tool.name));
              }}
            >
              全选
            </Button>
            <Button
              variant="text"
              size="sm"
              className="px-1.5 py-0.5 text-2xs"
              disabled={!interactive || noneSelected}
              onClick={() => {
                onChange([]);
              }}
            >
              取消全选
            </Button>
          </div>
        )}
      </div>

      <CheckboxGroup
        className={settingsToolCardListClass}
        disabled={disabled || readOnly}
        value={value}
        onValueChange={(next) => {
          if (!interactive) {
            return;
          }
          onChange(next);
        }}
      >
        {tools.map((tool) => {
          const selected = selectedSet.has(tool.name);
          return (
            <label
              key={tool.name}
              className={cn(settingsToolCardClass, selected && settingsToolCardSelectedClass)}
            >
              <SettingsCheckbox readOnly={readOnly} value={tool.name} />
              <span className={settingsToolCardBodyClass}>
                <span className={settingsToolCardTitleClass}>{tool.name}</span>
                {tool.description ? (
                  <span className={settingsToolCardDescriptionClass}>{tool.description}</span>
                ) : null}
              </span>
            </label>
          );
        })}
      </CheckboxGroup>
    </div>
  );
}
