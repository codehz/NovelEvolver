import { getDefaultStore } from "jotai";

import { QuickPickDismissedError } from "./errors";
import { activeQuickPickSessionAtom, quickPickQueueAtom } from "./store";
import type {
  QuickPickListResult,
  QuickPickQueueEntry,
  QuickPickSession,
  ShowQuickPickInputOptions,
  ShowQuickPickListOptions,
} from "./types";

const defaultStore = getDefaultStore();

type PendingSettlement<T> = {
  resolve: (value: T) => void;
  reject: (error: QuickPickDismissedError) => void;
};

const pendingSettlements = new Map<string, PendingSettlement<unknown>>();

function createRequestId(): string {
  return crypto.randomUUID();
}

function activateNextSession(): void {
  const queue = defaultStore.get(quickPickQueueAtom);
  if (queue.length === 0) {
    defaultStore.set(activeQuickPickSessionAtom, null);
    return;
  }
  const [next, ...rest] = queue;
  defaultStore.set(quickPickQueueAtom, rest);
  defaultStore.set(activeQuickPickSessionAtom, next);
}

function enqueueSession(session: QuickPickSession): void {
  const active = defaultStore.get(activeQuickPickSessionAtom);
  if (active == null) {
    defaultStore.set(activeQuickPickSessionAtom, session);
    return;
  }
  defaultStore.set(quickPickQueueAtom, (prev) => [...prev, session]);
}

function settleRequest<T>(requestId: string, result: { ok: true; value: T } | { ok: false }): void {
  const pending = pendingSettlements.get(requestId);
  if (pending != null) {
    pendingSettlements.delete(requestId);
    if (result.ok) {
      pending.resolve(result.value);
    } else {
      pending.reject(new QuickPickDismissedError());
    }
  }
  const active = defaultStore.get(activeQuickPickSessionAtom);
  if (active?.requestId === requestId) {
    activateNextSession();
  }
}

function showList(options: ShowQuickPickListOptions): Promise<QuickPickListResult> {
  const requestId = createRequestId();
  const session: QuickPickQueueEntry = { requestId, kind: "list", options };
  return new Promise<QuickPickListResult>((resolve, reject) => {
    pendingSettlements.set(requestId, {
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    enqueueSession(session);
  });
}

function showInput(options: ShowQuickPickInputOptions): Promise<string> {
  const requestId = createRequestId();
  const session: QuickPickQueueEntry = { requestId, kind: "input", options };
  return new Promise<string>((resolve, reject) => {
    pendingSettlements.set(requestId, {
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    enqueueSession(session);
  });
}

export const quickPickHostApi = {
  resolveList(requestId: string, result: QuickPickListResult): void {
    settleRequest(requestId, { ok: true, value: result });
  },

  resolveInput(requestId: string, value: string): void {
    settleRequest(requestId, { ok: true, value });
  },

  dismiss(requestId: string): void {
    settleRequest(requestId, { ok: false });
  },
};

export const quickPickApi = {
  showList,
  showInput,
};
