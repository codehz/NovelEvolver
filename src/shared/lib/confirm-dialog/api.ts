import { getDefaultStore } from "jotai";

import { activeConfirmDialogSessionAtom, confirmDialogQueueAtom } from "./store";
import type {
  ConfirmDialogOptions,
  ConfirmDialogQueueEntry,
  ConfirmDialogSession,
  UnsavedChangesChoice,
  UnsavedChangesDialogOptions,
} from "./types";

const defaultStore = getDefaultStore();

type PendingSettlement =
  | { kind: "confirm"; resolve: (value: boolean) => void }
  | { kind: "unsaved"; resolve: (value: UnsavedChangesChoice) => void };

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

function settleConfirm(requestId: string, confirmed: boolean): void {
  const pending = pendingSettlements.get(requestId);
  if (pending?.kind === "confirm") {
    pendingSettlements.delete(requestId);
    pending.resolve(confirmed);
  }
  const active = defaultStore.get(activeConfirmDialogSessionAtom);
  if (active?.requestId === requestId) {
    activateNextSession();
  }
}

function settleUnsaved(requestId: string, choice: UnsavedChangesChoice): void {
  const pending = pendingSettlements.get(requestId);
  if (pending?.kind === "unsaved") {
    pendingSettlements.delete(requestId);
    pending.resolve(choice);
  }
  const active = defaultStore.get(activeConfirmDialogSessionAtom);
  if (active?.requestId === requestId) {
    activateNextSession();
  }
}

function confirm(options: ConfirmDialogOptions): Promise<boolean> {
  const requestId = createRequestId();
  const session: ConfirmDialogQueueEntry = { requestId, kind: "confirm", options };
  return new Promise<boolean>((resolve) => {
    pendingSettlements.set(requestId, { kind: "confirm", resolve });
    enqueueSession(session);
  });
}

function confirmUnsavedChanges(
  options: UnsavedChangesDialogOptions = {},
): Promise<UnsavedChangesChoice> {
  const requestId = createRequestId();
  const session: ConfirmDialogQueueEntry = { requestId, kind: "unsaved", options };
  return new Promise<UnsavedChangesChoice>((resolve) => {
    pendingSettlements.set(requestId, { kind: "unsaved", resolve });
    enqueueSession(session);
  });
}

export const confirmDialogHostApi = {
  resolveConfirm(requestId: string, confirmed: boolean): void {
    settleConfirm(requestId, confirmed);
  },
  resolveUnsaved(requestId: string, choice: UnsavedChangesChoice): void {
    settleUnsaved(requestId, choice);
  },
};

export const confirmDialogApi = {
  confirm,
  confirmUnsavedChanges,
};
