import { getDefaultStore } from "jotai";

import { settingsOpenAtom } from "./store";

const defaultStore = getDefaultStore();

export const settingsApi = {
  open(): void {
    defaultStore.set(settingsOpenAtom, true);
  },
  close(): void {
    defaultStore.set(settingsOpenAtom, false);
  },
  setOpen(open: boolean): void {
    defaultStore.set(settingsOpenAtom, open);
  },
  isOpen(): boolean {
    return defaultStore.get(settingsOpenAtom);
  },
};
