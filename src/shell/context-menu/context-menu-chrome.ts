import { cn } from "#app/shared/lib/ui/cn";

export const contextMenuPanelClass = cn(
  "fixed z-context-menu m-0 max-w-72 min-w-44 overflow-hidden rounded-md border border-titlebar-border bg-app-surface py-1 text-xs text-app-foreground shadow-context-menu app-region-no-drag",
  "opacity-0 transition transition-discrete duration-120 ease-[cubic-bezier(0.33,1,0.68,1)]",
  "open:opacity-100",
  "open:starting:opacity-0",
);

export const contextMenuListClass = cn("m-0 flex list-none flex-col p-0");

export const contextMenuItemClass = cn(
  "relative flex w-full cursor-default items-center gap-3 px-3 py-1 text-left text-xs leading-tight outline-none",
  "text-app-foreground",
  "data-highlighted:bg-ctp-surface0/70",
  "data-disabled:cursor-default data-disabled:text-app-muted",
);

export const contextMenuItemLabelClass = cn("min-w-0 flex-1 truncate");

export const contextMenuItemAcceleratorClass = cn("shrink-0 text-2xs text-app-muted tabular-nums");

export const contextMenuItemChevronClass = cn(
  "icon-[codicon--chevron-right] shrink-0 text-sm text-app-muted",
);

export const contextMenuSeparatorClass = cn("my-1 h-px bg-titlebar-border");

export const contextMenuSubmenuPanelClass = cn(
  "fixed z-context-menu m-0 max-w-72 min-w-44 overflow-hidden rounded-md border border-titlebar-border bg-app-surface py-1 text-xs text-app-foreground shadow-context-menu app-region-no-drag",
);
