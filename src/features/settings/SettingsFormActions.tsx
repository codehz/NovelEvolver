import { Button } from "#app/shared/ui";

type SettingsFormActionsProps = {
  busy?: boolean;
  /** Primary submit label when idle (e.g. 保存 / 添加). */
  submitLabel: string;
  /** Label while busy; defaults to "保存中…". */
  busyLabel?: string;
  disabled?: boolean;
  /**
   * Associate an external submit button with a form by id.
   * Used when the primary action lives in a fixed header outside `<form>`.
   */
  form?: string;
};

/** Primary settings submit control (header or form-adjacent). */
export function SettingsFormActions({
  busy = false,
  submitLabel,
  busyLabel = "保存中…",
  disabled = false,
  form,
}: SettingsFormActionsProps) {
  return (
    <Button disabled={busy || disabled} form={form} type="submit" variant="primary">
      {busy ? busyLabel : submitLabel}
    </Button>
  );
}
