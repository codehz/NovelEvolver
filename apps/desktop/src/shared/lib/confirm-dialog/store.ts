import { atom } from "jotai";

import type { ConfirmDialogQueueEntry, ConfirmDialogSession } from "./types";

export const confirmDialogQueueAtom = atom<ConfirmDialogQueueEntry[]>([]);

export const activeConfirmDialogSessionAtom = atom<ConfirmDialogSession | null>(null);

export const confirmDialogOpenAtom = atom((get) => get(activeConfirmDialogSessionAtom) != null);
