import { atom } from "jotai";

import type { ContextMenuSession } from "./types";

export const activeContextMenuSessionAtom = atom<ContextMenuSession | null>(null);

export const contextMenuOpenAtom = atom((get) => get(activeContextMenuSessionAtom) != null);
