import { getDefaultStore } from "jotai";

import { activeContextMenuSessionAtom } from "./store";
import type { ContextMenuItem, ContextMenuPosition, ContextMenuSession } from "./types";

const defaultStore = getDefaultStore();

type PendingSettlement = {
  resolve: (value: string | null) => void;
};

const pendingSettlements = new Map<string, PendingSettlement>();

function createRequestId(): string {
  return crypto.randomUUID();
}

function settle(requestId: string, value: string | null): void {
  const pending = pendingSettlements.get(requestId);
  if (pending != null) {
    pendingSettlements.delete(requestId);
    pending.resolve(value);
  }
  const active = defaultStore.get(activeContextMenuSessionAtom);
  if (active?.requestId === requestId) {
    defaultStore.set(activeContextMenuSessionAtom, null);
  }
}

function dismissRequest(requestId: string): void {
  settle(requestId, null);
}

function replaceActiveSession(session: ContextMenuSession): void {
  const previous = defaultStore.get(activeContextMenuSessionAtom);
  if (previous != null) {
    const pending = pendingSettlements.get(previous.requestId);
    if (pending != null) {
      pendingSettlements.delete(previous.requestId);
      pending.resolve(null);
    }
  }
  defaultStore.set(activeContextMenuSessionAtom, session);
}

function show(items: ContextMenuItem[], position: ContextMenuPosition): Promise<string | null> {
  if (items.length === 0) {
    return Promise.resolve(null);
  }
  const requestId = createRequestId();
  const session: ContextMenuSession = { requestId, items, position };
  return new Promise<string | null>((resolve) => {
    pendingSettlements.set(requestId, { resolve });
    replaceActiveSession(session);
  });
}

export const contextMenuHostApi = {
  resolve(requestId: string, id: string): void {
    settle(requestId, id);
  },

  dismiss(requestId: string): void {
    dismissRequest(requestId);
  },
};

export const contextMenuApi = {
  show,
};
