import { Select } from "@base-ui/react/select";

import {
  settingsSelectIconClass,
  settingsSelectItemClass,
  settingsSelectItemIndicatorClass,
  settingsSelectItemTextClass,
  settingsSelectListClass,
  settingsSelectPopupClass,
  settingsSelectPositionerClass,
  settingsSelectTriggerClass,
  settingsSelectValueClass,
} from "./settings-chrome";

export type SettingsSelectOption<T extends string = string> = {
  value: T;
  label: string;
};

type SettingsSelectProps<T extends string> = {
  id?: string;
  /** Field/form name when used outside or alongside Field.Root. */
  name?: string;
  value: T;
  options: readonly SettingsSelectOption<T>[];
  disabled?: boolean;
  required?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  onValueChange: (value: T) => void;
};

/**
 * Settings-form Select built on Base UI. Matches native `<select>` field width
 * and keeps popup styling aligned with the settings dialog chrome.
 */
export function SettingsSelect<T extends string>({
  id,
  name,
  value,
  options,
  disabled = false,
  required = false,
  readOnly = false,
  placeholder,
  onValueChange,
}: SettingsSelectProps<T>) {
  return (
    <Select.Root
      id={id}
      name={name}
      value={value}
      items={options}
      disabled={disabled}
      required={required}
      readOnly={readOnly}
      onValueChange={(next) => {
        if (next == null) {
          return;
        }
        onValueChange(next as T);
      }}
    >
      <Select.Trigger className={settingsSelectTriggerClass}>
        <Select.Value className={settingsSelectValueClass} placeholder={placeholder} />
        <Select.Icon className={settingsSelectIconClass}>
          <span aria-hidden="true" className="icon-[codicon--chevron-down]" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          className={settingsSelectPositionerClass}
          sideOffset={4}
          alignItemWithTrigger={false}
          positionMethod="fixed"
        >
          <Select.Popup className={settingsSelectPopupClass}>
            <Select.List className={settingsSelectListClass}>
              {options.map((option) => (
                <Select.Item
                  key={option.value === "" ? "__empty__" : option.value}
                  value={option.value}
                  label={option.label}
                  className={settingsSelectItemClass}
                >
                  <Select.ItemIndicator className={settingsSelectItemIndicatorClass}>
                    <span aria-hidden="true" className="icon-[codicon--check] text-xs" />
                  </Select.ItemIndicator>
                  <Select.ItemText className={settingsSelectItemTextClass}>
                    {option.label}
                  </Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
