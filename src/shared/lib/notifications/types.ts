export type NotificationSeverity = "info" | "warning" | "error" | "progress";

/** Toast visible in stack | hidden from stack but in center | removed everywhere */
export type NotificationLifecycle = "toast" | "dismissed" | "closed";

export type StoredNotificationAction = {
  id: string;
  label: string;
  closeOnRun: boolean;
};

export type AppNotification = {
  id: string;
  severity: NotificationSeverity;
  message: string;
  source?: string;
  actions: StoredNotificationAction[];
  createdAt: number;
  lifecycle: NotificationLifecycle;
  progress?: number;
  sticky: boolean;
  dedupeKey?: string;
  /** When set, toast auto-hides to the notification center after this many ms. Manual close uses X → closed. */
  autoHideMs?: number;
};

export type ShowNotificationAction = {
  label: string;
  onClick: () => void | Promise<void>;
  closeOnRun?: boolean;
};

export type ShowNotificationOptions = {
  source?: string;
  actions?: ShowNotificationAction[];
  sticky?: boolean;
  autoHideMs?: number;
  dedupeKey?: string;
  progress?: number;
};

export type ShowNotificationInput = {
  severity: NotificationSeverity;
  message: string;
} & ShowNotificationOptions;
