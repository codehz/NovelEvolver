import type { NotificationSeverity } from "#app/shared/lib/notifications";
import { cn } from "#app/shared/lib/ui/cn";

const notificationAccentTextClass = cn("text-ctp-mauve");
const notificationSurfaceClass = cn("border-badge-background bg-app-surface");

export const notificationBellAnchorClass = cn("relative flex shrink-0 items-stretch self-stretch");

export const notificationPanelClass = cn(
  "flex min-h-0 w-notification-panel flex-col overflow-hidden rounded-sm border text-xs text-app-foreground shadow-lg app-region-no-drag",
  notificationSurfaceClass,
);

export const notificationPanelHeightShellClass = cn("w-full overflow-hidden");

export const notificationPanelContentClass = cn("flex max-h-88 min-h-0 w-full flex-col");

export const notificationCenterPositionerClass = cn("z-notification outline-none");

export const notificationCenterPopoverPanelClass = cn(
  "min-w-notification-panel origin-(--transform-origin) outline-none",
  "transition-[opacity,translate] duration-220 ease-[cubic-bezier(0.33,1,0.68,1)]",
  "data-starting-style:translate-y-1 data-starting-style:opacity-0",
  "data-ending-style:translate-y-1 data-ending-style:opacity-0",
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
