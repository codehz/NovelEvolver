import { cn } from "#app/shared/lib/ui/cn";
import {
  iconButtonHoverClass,
  overlayOpacityMotionClass,
} from "#app/shared/lib/ui/interaction-chrome";

const overlayTransitionClass = cn(
  overlayOpacityMotionClass,
  "data-ending-style:opacity-0 data-starting-style:opacity-0",
);

export const projectSettingsBackdropClass = cn(
  "fixed inset-0 z-settings min-h-dvh bg-ctp-crust/55",
  overlayTransitionClass,
);

export const projectSettingsPanelClass = cn(
  "fixed top-1/2 left-1/2 z-settings flex max-h-[min(70vh,28rem)] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-titlebar-border bg-app-surface text-sm text-app-foreground shadow-quick-pick outline-none app-region-no-drag",
  overlayTransitionClass,
);

export const projectSettingsHeaderClass = cn(
  "flex h-9 shrink-0 items-center gap-2 border-b border-titlebar-border/60 px-3",
);

export const projectSettingsTitleClass = cn(
  "flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium text-app-foreground",
);

export const projectSettingsIconButtonClass = cn(
  "inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-app-muted hover:text-app-foreground",
  iconButtonHoverClass,
);

export const projectSettingsBodyClass = cn("min-h-0 flex-1 overflow-y-auto p-3");

export const projectSettingsFooterClass = cn(
  "flex shrink-0 items-center justify-end gap-2 border-t border-titlebar-border/60 px-3 py-2.5",
);

export const projectSettingsReadonlyValueClass = cn(
  "flex min-h-8 items-center text-xs leading-5 break-all text-app-muted",
);
