import { Checkbox } from "@base-ui/react/checkbox";

import { cn } from "#app/shared/lib/ui/cn";

import { settingsCheckboxClass, settingsCheckboxIndicatorClass } from "./settings-chrome";

type SettingsCheckboxProps = {
  /** Controlled checked state (standalone). Omit when used inside CheckboxGroup. */
  checked?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /** Identity when used inside CheckboxGroup (`value` of the group item). */
  value?: string;
  className?: string;
  onCheckedChange?: (checked: boolean) => void;
};

/** Settings-form checkbox built on Base UI. */
export function SettingsCheckbox({
  checked,
  disabled = false,
  readOnly = false,
  value,
  className,
  onCheckedChange,
}: SettingsCheckboxProps) {
  return (
    <Checkbox.Root
      disabled={disabled}
      readOnly={readOnly}
      value={value}
      className={cn(settingsCheckboxClass, className)}
      {...(checked !== undefined ? { checked } : {})}
      {...(onCheckedChange
        ? {
            onCheckedChange: (next: boolean) => {
              onCheckedChange(next);
            },
          }
        : {})}
    >
      <Checkbox.Indicator className={settingsCheckboxIndicatorClass}>
        <span aria-hidden="true" className="icon-[codicon--check] text-[10px] leading-none" />
      </Checkbox.Indicator>
    </Checkbox.Root>
  );
}
