import { atom } from "jotai";

import type { QuickPickQueueEntry, QuickPickSession } from "./types";

export const quickPickQueueAtom = atom<QuickPickQueueEntry[]>([]);

export const activeQuickPickSessionAtom = atom<QuickPickSession | null>(null);

export const quickPickOpenAtom = atom((get) => get(activeQuickPickSessionAtom) != null);
