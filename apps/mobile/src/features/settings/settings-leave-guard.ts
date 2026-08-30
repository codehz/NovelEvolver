type ConfirmLeave = () => Promise<boolean>;

let dirty = false;
let confirmLeave: ConfirmLeave | null = null;

export function setSettingsDirty(next: boolean): void {
  dirty = next;
}

export function setSettingsLeaveConfirm(next: ConfirmLeave | null): void {
  confirmLeave = next;
}

export async function requestSettingsLeave(): Promise<boolean> {
  if (!dirty) {
    return true;
  }
  if (!confirmLeave) {
    return false;
  }
  const ok = await confirmLeave();
  if (ok) {
    dirty = false;
  }
  return ok;
}
