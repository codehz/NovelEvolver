import { confirmDialogApi } from "#app/shared/lib/confirm-dialog";

/** Imperative handle exposed by settings config forms for leave-time save. */
export type SettingsFormHandle = {
  save: () => Promise<boolean>;
};

/**
 * Active settings leave guard.
 * Returns true when navigation/close may proceed; false to stay.
 */
export type SettingsLeaveGuard = () => Promise<boolean>;

let activeGuard: SettingsLeaveGuard | null = null;

export function setActiveSettingsLeaveGuard(guard: SettingsLeaveGuard | null): void {
  activeGuard = guard;
}

/** Ask the active editor whether leaving is allowed (true = leave). */
export async function requestSettingsLeave(): Promise<boolean> {
  if (activeGuard == null) {
    return true;
  }
  return activeGuard();
}

type CreateSettingsLeaveGuardOptions = {
  isDirty: () => boolean;
  isBusy?: () => boolean;
  save: () => Promise<boolean>;
  /** Called when the user chooses "don't save"; reset dirty baseline / remount form. */
  onDiscard?: () => void;
};

/**
 * Build a leave guard for a settings editor (subpage or master-detail form).
 * clean → allow; dirty → save / discard / cancel dialog.
 */
export function createSettingsLeaveGuard(
  options: CreateSettingsLeaveGuardOptions,
): SettingsLeaveGuard {
  return async () => {
    if (options.isBusy?.()) {
      return false;
    }
    if (!options.isDirty()) {
      return true;
    }
    const choice = await confirmDialogApi.confirmUnsavedChanges();
    if (choice === "cancel") {
      return false;
    }
    if (choice === "discard") {
      options.onDiscard?.();
      return true;
    }
    return options.save();
  };
}
