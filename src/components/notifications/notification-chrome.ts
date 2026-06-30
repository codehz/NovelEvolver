import { cn } from "@/lib/cn";
import type { NotificationSeverity } from "@/lib/notifications";

export const notificationBellAnchorClass = cn(
  "notification-bell-anchor relative flex shrink-0 items-stretch self-stretch",
);

export const notificationPanelClass = cn(
  "grid max-h-notification-panel-max-height min-h-0 w-notification-panel grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-sm border border-notification-border bg-notification-surface text-xs text-app-foreground shadow-lg app-region-no-drag",
);

export const notificationCenterPopoverPanelClass = cn(
  "notification-center-popover m-0 min-w-notification-panel",
  notificationPanelClass,
);

export const notificationToastClass = cn(
  "pointer-events-auto w-notification-panel rounded-sm border border-notification-border bg-notification-surface text-xs text-app-foreground shadow-lg app-region-no-drag",
);

export const notificationSeverityIconClass: Record<NotificationSeverity, string> = {
  info: cn("icon-[codicon--info] text-notification-info"),
  warning: cn("icon-[codicon--warning] text-notification-warning"),
  error: cn("icon-[codicon--error] text-notification-error"),
  progress: cn("icon-[codicon--sync] animate-spin text-notification-info"),
};

export const notificationActionButtonClass = cn(
  "shrink-0 rounded-sm px-1.5 py-0.5 text-notification-action hover:bg-window-button-hover",
);

export const notificationCloseButtonClass = cn(
  "inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-workbench-status-bar-muted hover:bg-window-button-hover hover:text-app-foreground",
);
