import type { NotificationSeverity } from "#app/shared/lib/notifications";
import { cn } from "#app/shared/lib/ui/cn";
import {
  controlDisabledClass,
  iconButtonHoverClass,
  overlayMotionClass,
  popoverSurfaceClass,
} from "#app/shared/lib/ui/interaction-chrome";

const notificationAccentTextClass = cn("text-ctp-mauve");

export const notificationBellAnchorClass = cn("relative flex shrink-0 items-stretch self-stretch");

export const notificationPanelClass = cn(
  "flex min-h-0 w-notification-panel flex-col shadow-lg",
  popoverSurfaceClass,
  "rounded-sm",
);

export const notificationPanelHeightShellClass = cn("w-full overflow-hidden");

export const notificationPanelContentClass = cn("flex max-h-88 min-h-0 w-full flex-col");

/** Notification list: fill remaining panel height and scroll. */
export const notificationListScrollClass = cn(
  "h-0 min-h-0 flex-1 overflow-x-hidden overflow-y-auto",
);

export const notificationCenterPositionerClass = cn("z-notification outline-none");

export const notificationCenterPopoverPanelClass = cn(
  "min-w-notification-panel origin-(--transform-origin) outline-none",
  "data-starting-style:translate-y-1 data-starting-style:opacity-0",
  "data-ending-style:translate-y-1 data-ending-style:opacity-0",
  overlayMotionClass,
  notificationPanelClass,
);

export const notificationToastClass = cn(
  "pointer-events-auto w-notification-panel shadow-lg",
  popoverSurfaceClass,
  "rounded-sm",
);

export const notificationCenterItemDividerClass = cn("shadow-notification-item-divider");

export const notificationSeverityIconClass: Record<NotificationSeverity, string> = {
  info: cn("icon-[codicon--info] text-ctp-blue"),
  warning: cn("icon-[codicon--warning] text-ctp-yellow"),
  error: cn("icon-[codicon--error] text-ctp-red"),
  progress: cn("icon-[codicon--sync] animate-spin text-ctp-blue"),
};

export const notificationActionButtonClass = cn(
  "shrink-0 rounded-sm px-1.5 py-0.5",
  controlDisabledClass,
  iconButtonHoverClass,
  notificationAccentTextClass,
);

/** Square icon-only control (panel header, list dismiss, etc.). */
export const notificationIconButtonClass = cn(
  "inline-flex size-6 shrink-0 items-center justify-center rounded-sm",
  controlDisabledClass,
  iconButtonHoverClass,
);

/** Base UI Progress track for progress notifications. */
export const notificationProgressTrackClass = cn(
  "mt-1.5 h-1 w-full overflow-hidden rounded-full bg-badge-background/25",
);

export const notificationProgressIndicatorClass = cn(
  "rounded-full bg-badge-background transition-[width] duration-200",
);
