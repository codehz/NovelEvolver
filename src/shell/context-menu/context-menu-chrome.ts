import { cn } from "#app/shared/lib/ui/cn";
import { menuItemHighlightClass, menuMotionClass } from "#app/shared/lib/ui/interaction-chrome";

export const contextMenuPositionerClass = cn("z-context-menu outline-none");

export const contextMenuPanelClass = cn(
  "max-w-72 min-w-44 origin-(--transform-origin) overflow-hidden rounded-lg border border-titlebar-border bg-app-surface py-1 text-xs text-app-foreground shadow-context-menu outline-none app-region-no-drag",
  menuMotionClass,
  "data-starting-style:opacity-0",
  "data-ending-style:opacity-0",
);

export const contextMenuItemClass = cn(
  "relative flex w-full cursor-default items-center gap-3 px-3 py-1 text-left text-xs leading-tight outline-none select-none",
  "text-app-foreground",
  menuItemHighlightClass,
  "data-disabled:cursor-default data-disabled:text-app-muted",
);

export const contextMenuItemLabelClass = cn("min-w-0 flex-1 truncate");

export const contextMenuItemAcceleratorClass = cn("shrink-0 text-2xs text-app-muted tabular-nums");

export const contextMenuItemChevronClass = cn(
  "icon-[codicon--chevron-right] shrink-0 text-sm text-app-muted",
);

export const contextMenuSeparatorClass = cn("m-1 h-px bg-titlebar-border");
