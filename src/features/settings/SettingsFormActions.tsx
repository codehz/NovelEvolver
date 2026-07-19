import { Button } from "#app/shared/ui";

import { settingsFormActionsClass } from "./settings-chrome";

type SettingsFormActionsProps = {
  busy?: boolean;
  /** Primary submit label when idle (e.g. 保存 / 添加). */
  submitLabel: string;
  /** Label while busy; defaults to "保存中…". */
  busyLabel?: string;
  disabled?: boolean;
};

/** Primary-only settings form footer (no cancel / reset). */
export function SettingsFormActions({
  busy = false,
  submitLabel,
  busyLabel = "保存中…",
  disabled = false,
}: SettingsFormActionsProps) {
  return (
    <div className={settingsFormActionsClass}>
      <Button disabled={busy || disabled} type="submit" variant="primary">
        {busy ? busyLabel : submitLabel}
      </Button>
    </div>
  );
}
