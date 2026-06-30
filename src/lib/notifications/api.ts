import { getDefaultStore } from "jotai";

import {
  clearActionHandlersForNotification,
  registerActionHandlers,
  runActionHandler,
  unregisterActionHandlers,
} from "./action-handlers";
import {
  closeAllNotifications,
  notificationsAtom,
  patchNotification,
  setNotificationLifecycle,
} from "./store";
import type {
  AppNotification,
  NotificationSeverity,
  ShowNotificationInput,
  ShowNotificationOptions,
  StoredNotificationAction,
} from "./types";

const defaultStore = getDefaultStore();

const autoHideTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearAutoHideTimer(id: string): void {
  const timer = autoHideTimers.get(id);
  if (timer != null) {
    clearTimeout(timer);
    autoHideTimers.delete(id);
  }
}

function defaultAutoHideMs(severity: NotificationSeverity, sticky: boolean): number | null {
  if (sticky || severity === "warning" || severity === "error" || severity === "progress") {
    return null;
  }
  return 5000;
}

function createId(): string {
  return crypto.randomUUID();
}

function createActionId(): string {
  return crypto.randomUUID();
}

function buildStoredActions(
  notificationId: string,
  actions: ShowNotificationInput["actions"],
): StoredNotificationAction[] {
  if (actions == null || actions.length === 0) {
    return [];
  }
  const stored: StoredNotificationAction[] = [];
  const registrations: Array<{ id: string; onClick: () => void | Promise<void> }> = [];
  for (const action of actions) {
    const id = createActionId();
    stored.push({ id, label: action.label, closeOnRun: action.closeOnRun ?? true });
    registrations.push({ id, onClick: action.onClick });
  }
  registerActionHandlers(notificationId, registrations);
  return stored;
}

function scheduleAutoHide(id: string, ms: number): void {
  clearAutoHideTimer(id);
  const timer = setTimeout(() => {
    autoHideTimers.delete(id);
    notificationApi.dismissToast(id);
  }, ms);
  autoHideTimers.set(id, timer);
}

function resolveAutoHideMs(input: ShowNotificationInput, sticky: boolean): number | null {
  return input.autoHideMs ?? defaultAutoHideMs(input.severity, sticky);
}

function show(input: ShowNotificationInput): string {
  const id = createId();
  const sticky = input.sticky ?? false;
  const autoMs = resolveAutoHideMs(input, sticky);
  const actions = buildStoredActions(id, input.actions);
  const notification: AppNotification = {
    id,
    severity: input.severity,
    message: input.message,
    source: input.source,
    actions,
    createdAt: Date.now(),
    lifecycle: "toast",
    progress: input.progress,
    sticky,
    dedupeKey: input.dedupeKey,
    autoHideMs: autoMs ?? undefined,
  };

  if (input.dedupeKey != null) {
    const prev = defaultStore.get(notificationsAtom);
    const existing = prev.find((n) => n.dedupeKey === input.dedupeKey && n.lifecycle !== "closed");
    if (existing != null) {
      clearActionHandlersForNotification(existing.id);
      unregisterActionHandlers(
        existing.id,
        existing.actions.map((a) => a.id),
      );
      clearAutoHideTimer(existing.id);
      const patch: Partial<AppNotification> = {
        severity: input.severity,
        message: input.message,
        source: input.source,
        progress: input.progress,
        sticky,
        actions: buildStoredActions(existing.id, input.actions),
        lifecycle: existing.lifecycle === "dismissed" ? "toast" : existing.lifecycle,
        autoHideMs: autoMs ?? undefined,
      };
      defaultStore.set(notificationsAtom, (list) => patchNotification(list, existing.id, patch));
      if (autoMs != null) {
        scheduleAutoHide(existing.id, autoMs);
      }
      return existing.id;
    }
  }

  defaultStore.set(notificationsAtom, (prev) => [...prev, notification]);

  if (autoMs != null) {
    scheduleAutoHide(id, autoMs);
  }

  return id;
}

function showWithSeverity(
  severity: NotificationSeverity,
  message: string,
  options?: ShowNotificationOptions,
): string {
  return show({ severity, message, ...options });
}

export const notificationApi = {
  show,
  info(message: string, options?: ShowNotificationOptions): string {
    return showWithSeverity("info", message, options);
  },
  warning(message: string, options?: ShowNotificationOptions): string {
    return showWithSeverity("warning", message, options);
  },
  error(message: string, options?: ShowNotificationOptions): string {
    return showWithSeverity("error", message, options);
  },
  progress(message: string, options?: ShowNotificationOptions): string {
    return showWithSeverity("progress", message, { sticky: true, ...options });
  },

  update(
    id: string,
    patch: Partial<Pick<AppNotification, "message" | "progress" | "severity">>,
  ): void {
    defaultStore.set(notificationsAtom, (list) => patchNotification(list, id, patch));
  },

  /** Hide toast stack only; keeps item in the notification center. Used by auto-hide timers. */
  dismissToast(id: string): void {
    const item = defaultStore.get(notificationsAtom).find((n) => n.id === id);
    if (item?.autoHideMs == null) {
      return;
    }
    clearAutoHideTimer(id);
    defaultStore.set(notificationsAtom, (list) => setNotificationLifecycle(list, id, "dismissed"));
  },

  close(id: string): void {
    clearAutoHideTimer(id);
    defaultStore.set(notificationsAtom, (list) => {
      const item = list.find((n) => n.id === id);
      if (item != null) {
        clearActionHandlersForNotification(id);
        unregisterActionHandlers(
          id,
          item.actions.map((a) => a.id),
        );
      }
      return setNotificationLifecycle(list, id, "closed");
    });
  },

  closeAll(): void {
    const list = defaultStore.get(notificationsAtom);
    for (const n of list) {
      clearAutoHideTimer(n.id);
      clearActionHandlersForNotification(n.id);
    }
    defaultStore.set(notificationsAtom, closeAllNotifications);
  },

  runAction(notificationId: string, actionId: string): void {
    const list = defaultStore.get(notificationsAtom);
    const item = list.find((n) => n.id === notificationId);
    const action = item?.actions.find((a) => a.id === actionId);
    runActionHandler(notificationId, actionId);
    if (action?.closeOnRun) {
      notificationApi.close(notificationId);
    }
  },

  /** Re-open a dismissed notification in the toast stack (VS Code–style from center). */
  showToastAgain(id: string): void {
    defaultStore.set(notificationsAtom, (list) => setNotificationLifecycle(list, id, "toast"));
  },
};
