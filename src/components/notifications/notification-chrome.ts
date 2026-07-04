import { cn } from "#app/lib/cn";
import type { NotificationSeverity } from "#app/lib/notifications";

const notificationAccentTextClass = cn("text-ctp-mauve");
const notificationSurfaceClass = cn("border-badge-background bg-app-surface");

export const notificationBellAnchorClass = cn(
  "relative flex shrink-0 items-stretch self-stretch anchor-name-notification-bell",
);

export const notificationPanelClass = cn(
  "flex min-h-0 w-notification-panel flex-col overflow-hidden rounded-sm border text-xs text-app-foreground shadow-lg app-region-no-drag",
  notificationSurfaceClass,
);

export const notificationPanelHeightShellClass = cn("w-full overflow-hidden");

export const notificationPanelContentClass = cn(
  "flex max-h-notification-panel-max-height min-h-0 w-full flex-col",
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
  "pointer-events-auto w-notification-panel rounded-sm border text-xs text-app-foreground shadow-lg app-region-no-drag",
  notificationSurfaceClass,
);

export const notificationCenterItemDividerClass = cn("shadow-notification-item-divider");

export const notificationSeverityIconClass: Record<NotificationSeverity, string> = {
  info: cn("icon-[codicon--info] text-ctp-blue"),
  warning: cn("icon-[codicon--warning] text-ctp-yellow"),
  error: cn("icon-[codicon--error] text-ctp-red"),
  progress: cn("icon-[codicon--sync] animate-spin text-ctp-blue"),
};

export const notificationActionButtonClass = cn(
  "shrink-0 rounded-sm px-1.5 py-0.5 hover:bg-ctp-text/8",
  notificationAccentTextClass,
);

/** Square icon-only control (panel header, list dismiss, etc.). */
export const notificationIconButtonClass = cn(
  "inline-flex size-6 shrink-0 items-center justify-center rounded-sm hover:bg-ctp-text/8",
);
