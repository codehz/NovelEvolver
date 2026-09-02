import { useEffect, useSyncExternalStore } from "react";

type ConfirmLeave = () => Promise<boolean>;

let dirty = false;
let confirmLeave: ConfirmLeave | null = null;
const dirtyListeners = new Set<() => void>();

function emit(listeners: Set<() => void>): void {
  for (const listener of listeners) {
    listener();
  }
}

export function isSettingsDirty(): boolean {
  return dirty;
}

export function setSettingsDirty(next: boolean): void {
  if (dirty === next) {
    return;
  }
  dirty = next;
  emit(dirtyListeners);
}

/** Bind a form's computed dirty flag to the leave guard. */
export function useSettingsFormDirty(nextDirty: boolean): void {
  useEffect(() => {
    setSettingsDirty(nextDirty);
    return () => {
      setSettingsDirty(false);
    };
  }, [nextDirty]);
}

export function subscribeSettingsDirty(onStoreChange: () => void): () => void {
  dirtyListeners.add(onStoreChange);
  return () => {
    dirtyListeners.delete(onStoreChange);
  };
}

export function useSettingsDirty(): boolean {
  return useSyncExternalStore(subscribeSettingsDirty, isSettingsDirty, isSettingsDirty);
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
    setSettingsDirty(false);
  }
  return ok;
}
