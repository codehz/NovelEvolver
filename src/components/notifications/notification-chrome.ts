import { cn } from "@/lib/cn";
import type { NotificationSeverity } from "@/lib/notifications";

export const notificationBellAnchorClass = cn(
  "relative flex shrink-0 items-stretch self-stretch anchor-name-notification-bell",
);

export const notificationPanelClass = cn(
  "grid max-h-notification-panel-max-height min-h-0 w-notification-panel grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-sm border border-notification-border bg-notification-surface text-xs text-app-foreground shadow-lg app-region-no-drag",
);

export const notificationCenterPopoverPanelClass = cn(
  "fixed inset-[unset] m-0 min-w-notification-panel position-anchor-notification-bell",
  "bottom-[calc(anchor(top)+var(--spacing-notification-edge-inset))]",
  "right-[calc(anchor(right)+var(--spacing-notification-edge-inset))]",
  "translate-y-1 opacity-0 transition transition-discrete duration-220 ease-[cubic-bezier(0.33,1,0.68,1)]",
  "open:translate-y-0 open:opacity-100",
  "open:starting:translate-y-1 open:starting:opacity-0",
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
