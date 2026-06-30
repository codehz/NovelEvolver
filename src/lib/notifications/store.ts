import { atom } from "jotai";

import type { AppNotification, NotificationLifecycle } from "./types";

export const MAX_VISIBLE_TOASTS = 3;

export const notificationsAtom = atom<AppNotification[]>([]);

export const notificationCenterOpenAtom = atom(false);

export const activeNotificationsAtom = atom((get) =>
  get(notificationsAtom).filter((n) => n.lifecycle !== "closed"),
);

export const toastNotificationsAtom = atom((get) => {
  const toasts = get(notificationsAtom).filter((n) => n.lifecycle === "toast");
  return [...toasts].sort((a, b) => a.createdAt - b.createdAt).slice(-MAX_VISIBLE_TOASTS);
});

export function patchNotification(
  list: AppNotification[],
  id: string,
  patch: Partial<AppNotification>,
): AppNotification[] {
  return list.map((n) => (n.id === id ? { ...n, ...patch } : n));
}

export function setNotificationLifecycle(
  list: AppNotification[],
  id: string,
  lifecycle: NotificationLifecycle,
): AppNotification[] {
  return patchNotification(list, id, { lifecycle });
}

export function removeNotification(list: AppNotification[], id: string): AppNotification[] {
  return list.filter((n) => n.id !== id);
}

export function closeAllNotifications(list: AppNotification[]): AppNotification[] {
  return list.map((n) => (n.lifecycle === "closed" ? n : { ...n, lifecycle: "closed" as const }));
}
