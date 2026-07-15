import { getDefaultStore } from "jotai";

import { activeConfirmDialogSessionAtom, confirmDialogQueueAtom } from "./store";
import type { ConfirmDialogOptions, ConfirmDialogQueueEntry, ConfirmDialogSession } from "./types";

const defaultStore = getDefaultStore();

type PendingSettlement = {
  resolve: (value: boolean) => void;
};

const pendingSettlements = new Map<string, PendingSettlement>();

function createRequestId(): string {
  return crypto.randomUUID();
}

function activateNextSession(): void {
  const queue = defaultStore.get(confirmDialogQueueAtom);
  if (queue.length === 0) {
    defaultStore.set(activeConfirmDialogSessionAtom, null);
    return;
  }
  const [next, ...rest] = queue;
  defaultStore.set(confirmDialogQueueAtom, rest);
  defaultStore.set(activeConfirmDialogSessionAtom, next);
}

function enqueueSession(session: ConfirmDialogSession): void {
  const active = defaultStore.get(activeConfirmDialogSessionAtom);
  if (active == null) {
    defaultStore.set(activeConfirmDialogSessionAtom, session);
    return;
  }
  defaultStore.set(confirmDialogQueueAtom, (prev) => [...prev, session]);
}

function settleRequest(requestId: string, confirmed: boolean): void {
  const pending = pendingSettlements.get(requestId);
  if (pending != null) {
    pendingSettlements.delete(requestId);
    pending.resolve(confirmed);
  }
  const active = defaultStore.get(activeConfirmDialogSessionAtom);
  if (active?.requestId === requestId) {
    activateNextSession();
  }
}

function confirm(options: ConfirmDialogOptions): Promise<boolean> {
  const requestId = createRequestId();
  const session: ConfirmDialogQueueEntry = { requestId, options };
  return new Promise<boolean>((resolve) => {
    pendingSettlements.set(requestId, { resolve });
    enqueueSession(session);
  });
}

export const confirmDialogHostApi = {
  resolve(requestId: string, confirmed: boolean): void {
    settleRequest(requestId, confirmed);
  },
};

export const confirmDialogApi = {
  confirm,
};
