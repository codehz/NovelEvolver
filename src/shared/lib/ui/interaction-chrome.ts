import { cn } from "./cn";

/** Keyboard focus ring for chrome / icon controls (workbench standard). */
export const controlFocusVisibleClass = cn(
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-badge-background",
);

/** Softer inset focus for compact form controls (checkbox, tight fields). */
export const controlFocusVisibleInsetClass = cn(
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-badge-background/70",
);

/** Subtle hover wash for icon-only buttons. */
export const iconButtonHoverClass = cn("hover:bg-ctp-text/8");

/** Soft hover for list/table rows (non-menu). */
export const rowHoverClass = cn("hover:bg-ctp-surface0/55");

/** Soft hover for panel-level secondary actions / surfaces. */
export const panelHoverClass = cn("hover:bg-ctp-surface0/40");

/** Combobox / QuickPick highlighted list row. */
export const listRowHighlightClass = cn("data-highlighted:bg-ctp-surface0/55");

/** Menu / Select highlighted item. */
export const menuItemHighlightClass = cn("data-highlighted:bg-ctp-surface0/70");

/** Standard overlay enter/exit motion (opacity + translate). */
export const overlayMotionClass = cn(
  "transition-[opacity,translate] duration-220 ease-[cubic-bezier(0.33,1,0.68,1)]",
);

/** Opacity-only overlay motion (dialogs / backdrops). */
export const overlayOpacityMotionClass = cn(
  "transition-opacity duration-220 ease-[cubic-bezier(0.33,1,0.68,1)]",
);

/** Quick fade for menus / selects. */
export const menuMotionClass = cn(
  "transition-opacity duration-120 ease-[cubic-bezier(0.33,1,0.68,1)]",
);

/** Popover / picker surface shell. */
export const popoverSurfaceClass = cn(
  "overflow-hidden rounded-lg border border-titlebar-border bg-app-surface text-xs text-app-foreground app-region-no-drag",
);

/** Compact search/filter input used in pickers and overlays. */
export const pickerSearchInputClass = cn(
  "w-full rounded-sm border border-badge-background bg-app-background px-2 py-1 text-xs leading-tight text-app-foreground outline-none app-region-no-drag placeholder:text-app-muted",
);

/** Collapsible panel height motion (disclosure), not for overlays. */
export const collapsibleHeightMotionClass = cn(
  "transition-[height] duration-220 ease-[cubic-bezier(0.22,1,0.36,1)]",
);
