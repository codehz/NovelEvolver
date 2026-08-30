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

/**
 * Text-field surface: light fill + transparent border at rest; accent border only when focused.
 * Compose with local size / padding; use `fieldSurfaceFocusWithinClass` for shells with adornments.
 */
export const fieldSurfaceClass = cn(
  "rounded-sm border border-transparent bg-ctp-surface0 transition-colors outline-none",
  "focus:border-badge-background",
);

/** Field surface that shows the accent border when any descendant is focused. */
export const fieldSurfaceFocusWithinClass = cn(
  "rounded-sm border border-transparent bg-ctp-surface0 transition-colors outline-none",
  "focus-within:border-badge-background",
);

/**
 * Standard disabled for clickable chrome controls (Button base, status bar items).
 * Blocks pointer so hover/focus washes cannot fire; dims to 50%.
 * Prefer this over ad-hoc `disabled:opacity-*` / `cursor-not-allowed`.
 */
export const controlDisabledClass = cn(
  "disabled:pointer-events-none disabled:opacity-50",
  "data-disabled:pointer-events-none data-disabled:opacity-50",
);

/**
 * Soft disabled for compact/icon chrome that should stay legible
 * (sidebar header actions, text-variant buttons, chat selector chips).
 */
export const controlDisabledSoftClass = cn(
  "disabled:pointer-events-none disabled:opacity-40",
  "data-disabled:pointer-events-none data-disabled:opacity-40",
);

/**
 * Field / select-trigger disabled: keep the control in layout (no PE kill) so
 * form focus semantics stay intact; dim + default cursor.
 */
export const fieldDisabledClass = cn(
  "disabled:cursor-default disabled:opacity-50",
  "data-disabled:cursor-default data-disabled:opacity-50",
);

/**
 * Menu / select / context-menu item: mute label color only (full structural opacity).
 */
export const menuItemDisabledClass = cn(
  "data-disabled:cursor-default data-disabled:text-app-muted",
);

/**
 * Label/card wrapper that follows a Base UI child with `data-disabled`.
 */
export const hasDisabledClass = cn("has-data-disabled:cursor-default has-data-disabled:opacity-50");

/**
 * Conditional surface dim for non-native disabled hosts
 * (CodeMirror shell, Toggle chips without native disabled styles).
 */
export const disabledSurfaceClass = cn("cursor-default opacity-50");

/** Single-line text input baseline on top of `fieldSurfaceClass` (add height/padding locally). */
export const fieldInputClass = cn(
  fieldSurfaceClass,
  fieldDisabledClass,
  "w-full min-w-0 text-xs leading-none text-app-foreground placeholder:text-app-muted",
);

/** Compact search/filter input used in pickers and overlays. */
export const pickerSearchInputClass = cn(fieldInputClass, "h-7 px-2 app-region-no-drag");

/** Collapsible panel height motion (disclosure), not for overlays. */
export const collapsibleHeightMotionClass = cn(
  "transition-[height] duration-220 ease-[cubic-bezier(0.22,1,0.36,1)]",
);
