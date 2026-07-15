import { cn } from "#app/shared/lib/ui/cn";
import { overlayOpacityMotionClass } from "#app/shared/lib/ui/interaction-chrome";

const confirmOverlayTransitionClass = cn(
  overlayOpacityMotionClass,
  "data-ending-style:opacity-0 data-starting-style:opacity-0",
);

export const confirmDialogBackdropClass = cn(
  "fixed inset-0 z-confirm-dialog min-h-dvh bg-ctp-crust/55",
  confirmOverlayTransitionClass,
);

export const confirmDialogPanelClass = cn(
  "fixed top-1/2 left-1/2 z-confirm-dialog flex w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-titlebar-border bg-app-surface text-sm text-app-foreground shadow-quick-pick outline-none app-region-no-drag",
  confirmOverlayTransitionClass,
);

export const confirmDialogBodyClass = cn("flex flex-col gap-2 px-4 pt-4 pb-3");

export const confirmDialogTitleClass = cn("text-sm font-medium text-app-foreground");

export const confirmDialogDescriptionClass = cn("text-2xs leading-relaxed text-app-muted");

export const confirmDialogFooterClass = cn(
  "flex items-center justify-end gap-2 border-t border-titlebar-border px-3 py-2.5",
);

/** Solid destructive confirm — local to this dialog, not a global Button variant. */
export const confirmDialogDangerConfirmClass = cn(
  "border-0 bg-ctp-red font-medium whitespace-nowrap text-badge-foreground",
  "hover:bg-ctp-red hover:opacity-90",
);
