import { cn } from "#app/shared/lib/ui/cn";
import {
  controlFocusVisibleInsetClass,
  fieldDisabledClass,
  fieldInputClass,
  fieldSurfaceClass,
  fieldSurfaceFocusWithinClass,
  hasDisabledClass,
  iconButtonHoverClass,
  menuItemDisabledClass,
  menuItemHighlightClass,
  menuMotionClass,
  overlayOpacityMotionClass,
  rowHoverClass,
} from "#app/shared/lib/ui/interaction-chrome";

const settingsOverlayTransitionClass = cn(
  overlayOpacityMotionClass,
  "data-ending-style:opacity-0 data-starting-style:opacity-0",
);

export const settingsBackdropClass = cn(
  "fixed inset-0 z-settings min-h-dvh bg-ctp-crust/55",
  settingsOverlayTransitionClass,
);

export const settingsPanelClass = cn(
  "fixed top-1/2 left-1/2 z-settings flex h-[min(70vh,36rem)] w-settings-dialog -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-titlebar-border bg-app-surface text-sm text-app-foreground shadow-quick-pick outline-none app-region-no-drag",
  settingsOverlayTransitionClass,
);

/**
 * Merged chrome row: title + category tabs + close.
 * Shares the dialog surface; no separate fill — hierarchy is the detail island, not a hairline.
 */
export const settingsHeaderClass = cn("flex h-9 shrink-0 items-center gap-2 px-2.5");

export const settingsTitleClass = cn(
  "flex shrink-0 items-center gap-1 text-xs font-medium text-app-muted",
);

export const settingsIconButtonClass = cn(
  "inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-app-muted hover:text-app-foreground",
  iconButtonHoverClass,
);

/** Ghost icon actions in settings lists / subpage headers: keep muted rest, brighten on hover. */
export const settingsGhostActionClass = cn("hover:text-app-foreground");

/** Tabs root fills the dialog popup. */
export const settingsTabsRootClass = cn("flex min-h-0 flex-1 flex-col overflow-hidden");

/** Category tabs share the header row (no second chrome strip). */
export const settingsTabListClass = cn("relative flex h-full min-w-0 flex-1 items-center gap-0.5");

/** Settings category tab — active color via Base UI `data-active`. */
export const settingsTabChipClass = cn(
  "relative z-1 inline-flex h-full shrink-0 items-center px-2 text-2xs leading-none font-medium text-app-muted outline-none select-none",
  "transition-colors duration-150 ease-[cubic-bezier(0.33,1,0.68,1)]",
  "hover:not-disabled:text-app-foreground",
  "data-active:text-app-foreground",
  controlFocusVisibleInsetClass,
);

/** Sliding underline driven by Base UI Tabs.Indicator CSS vars. */
export const settingsTabIndicatorClass = cn(
  "pointer-events-none absolute bottom-0 left-0 z-0 h-0.5 w-(--active-tab-width) translate-x-(--active-tab-left) rounded-full bg-badge-background",
  "transition-[translate,width] duration-220 ease-[cubic-bezier(0.33,1,0.68,1)]",
);

/**
 * Column body under the merged header — transparent over the dialog surface shell.
 * Visual lift lives on the right detail island (`app-background`), not this canvas.
 */
export const settingsBodyClass = cn("flex min-h-0 flex-1 flex-col overflow-hidden");

/** Settings main pane shell: fills body; child panels manage header + scroll. */
export const settingsContentClass = cn(
  "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
);

/** Panel root: optional fixed subpage header + independent scroll layers. */
export const settingsPanelRootClass = cn("flex h-full min-h-0 flex-col");

/**
 * Fixed subpage navigation bar above the content island.
 * No horizontal pad — parent `settingsSubpageShellClass` owns `p-2` inset.
 * `h-10` leaves room for a primary header action (save) without feeling tight.
 */
export const settingsSubpageHeaderClass = cn("flex h-7 shrink-0 items-center gap-2");
export const settingsSubpageTitleClass = cn(
  "min-w-0 flex-1 truncate text-sm font-medium text-app-foreground",
);

/**
 * Content stack pad inside a detail/subpage surface (or bare canvas when no shell).
 * Matches `settingsDualPaneDetailScrollClass` inset so form fields align across views.
 * Do not nest under another `px-*` / `p-*` owner.
 */
export const settingsPanelSectionClass = cn("flex flex-col gap-2 px-3 py-2");

export const settingsPanelHeaderClass = cn("flex items-start justify-between gap-2");

/**
 * Dual-pane shell (provider rail + detail).
 * Single spacing owner: `p-2` outer inset + `gap-2` between rail and detail island.
 * Children must not re-apply horizontal rail/detail padding that would double the gap.
 */
export const settingsDualPaneClass = cn("flex min-h-0 flex-1 gap-2 p-2");

/**
 * Column shell for subpages / solo content (header + body island).
 * Same spacing contract as dual-pane: `p-2` outer inset + `gap-2` between children.
 * Header and surface must not re-apply outer pad.
 */
export const settingsSubpageShellClass = cn("flex min-h-0 flex-1 flex-col gap-2 p-2");

/** Left master column — no outer pad; shell owns inset/gap. */
export const settingsDualPaneRailClass = cn("flex w-44 shrink-0 flex-col gap-1");

export const settingsDualPaneRailLabelClass = cn(
  "shrink-0 px-2 py-1 text-2xs font-medium text-app-muted",
);

export const settingsDualPaneRailScrollClass = cn("min-h-0 flex-1 overflow-y-auto");

export const settingsDualPaneRailListClass = cn("flex flex-col gap-0.5");

/** Bottom primary action under the rail list — no extra pad (shell `p-2` + rail `gap-1`). */
export const settingsDualPaneRailFooterClass = cn("shrink-0");

/** Right detail column — surface fill only; shell owns outer inset/gap. */
export const settingsDualPaneDetailClass = cn("flex min-h-0 min-w-0 flex-1 flex-col");

/**
 * Right detail island: border, radius, clip + original body canvas fill (`app-background`).
 * Sits elevated on the dark dialog shell; form surface islands stay elevated inside.
 */
export const settingsDetailSurfaceClass = cn(
  "overflow-hidden rounded-lg border border-titlebar-border bg-app-background",
);

/**
 * Detail header strip inside the card — fixed height so title+chip / title-only
 * rows do not change the island chrome (two-line title + meta, actions centered).
 */
export const settingsDualPaneDetailHeaderClass = cn(
  "flex h-14 shrink-0 items-center justify-between gap-2 px-3",
);

/** Title row next to optional status chip — single line, no wrap height jump. */
export const settingsDualPaneDetailTitleRowClass = cn("flex min-w-0 items-center gap-1.5");

export const settingsDualPaneDetailScrollClass = cn("min-h-0 flex-1 overflow-y-auto px-3 py-2");

/**
 * Provider rail row: transparent rest; hover/selected are surface0 tints on the body canvas.
 */
export const settingsRailItemClass = cn(
  "flex w-full min-w-0 flex-col gap-0.5 rounded-md px-2 py-1.5 text-left outline-none",
  rowHoverClass,
);

export const settingsRailItemSelectedClass = cn("bg-ctp-surface0/70 hover:bg-ctp-surface0/70");

/** Soft inset empty well on the body canvas — fill only, no dashed frame. */
export const settingsEmptyStateClass = cn(
  "rounded-md bg-app-surface/70 px-3 py-6 text-center text-xs text-app-muted",
);

export const settingsListClass = cn("flex flex-col gap-1.5");

/**
 * List row card on the body canvas: elevated `app-surface` island, no stroke.
 * Emphasis variants (e.g. default model) layer a tint wash instead of a border.
 */
export const settingsListItemClass = cn(
  "flex items-start gap-2.5 rounded-md bg-app-surface px-2.5 py-2",
);

/** Default / emphasized list row — badge wash, not a stroke. */
export const settingsListItemEmphasizedClass = cn("bg-badge-background/10");

export const settingsListItemTitleClass = cn("truncate text-xs font-medium text-app-foreground");

export const settingsListItemMetaClass = cn(
  "mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-2xs text-app-muted",
);

/** Toolbar above multi-select tool cards (count + bulk actions). */
export const settingsToolPickerToolbarClass = cn("flex min-w-0 items-center justify-between gap-2");

export const settingsToolPickerCountClass = cn("text-2xs text-app-muted");

export const settingsToolPickerActionsClass = cn("flex shrink-0 items-center gap-1");

/** Vertical stack of selectable tool cards. */
export const settingsToolCardListClass = cn("flex flex-col gap-1.5");

/**
 * Selectable tool card shell (label wrapping checkbox + copy).
 * Lives on a surface form: rest punches through to the body canvas color.
 */
export const settingsToolCardClass = cn(
  "flex cursor-pointer items-start gap-2.5 rounded-md bg-app-background px-2.5 py-2 text-app-foreground outline-none",
  hasDisabledClass,
  "hover:bg-app-background/80",
);

/** Selected tool card emphasis — tint wash, not a stroke. */
export const settingsToolCardSelectedClass = cn(
  "bg-badge-background/12 hover:bg-badge-background/16",
);

export const settingsToolCardBodyClass = cn("min-w-0 flex-1");

export const settingsToolCardTitleClass = cn(
  "truncate text-xs leading-tight font-medium text-app-foreground",
);

export const settingsToolCardDescriptionClass = cn("mt-0.5 text-2xs leading-snug text-app-muted");

export const settingsStatusBadgeClass = cn(
  "inline-flex h-4 shrink-0 items-center rounded-sm bg-ctp-surface0/70 px-1.5 text-2xs leading-none text-app-muted",
);

export const settingsStatusBadgeDefaultClass = cn("bg-badge-background/20 text-badge-background");

/**
 * Form stack inside a detail island / subpage card.
 * No fill or radius — the outer detail surface is the only card; avoid nested islands.
 * Outer padding comes from `settingsPanelSectionClass` or the detail scrollport.
 */
export const settingsFormClass = cn("flex flex-col gap-3");

export const settingsFormGridClass = cn(
  "grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2",
);

/** Lets Field.Root children participate in the 2-col settings grid. */
export const settingsFieldRootClass = cn("contents");

export const settingsFieldControlCellClass = cn("flex min-w-0 flex-col gap-1.5");

export const settingsFieldLabelClass = cn("flex h-8 items-center text-2xs text-app-muted");

export const settingsFieldDescriptionClass = cn("text-2xs text-app-muted");

export const settingsFieldErrorClass = cn("text-2xs text-ctp-red");

/** Fixed height + leading-none: py + leading-tight overflows the input content box and scrolls. */
export const settingsInputClass = cn(fieldInputClass, "h-8 px-2.5");

/** Multi-line control — do not share `h-8` / `leading-none` with single-line inputs. */
export const settingsTextareaClass = cn(
  fieldSurfaceClass,
  fieldDisabledClass,
  "w-full resize-y px-2.5 py-1.5 text-xs leading-5 text-app-foreground placeholder:text-app-muted",
);

/** Host shell for settings CodeMirror JSON editors (matches textarea chrome). */
export const settingsJsonEditorHostClass = cn(
  fieldSurfaceFocusWithinClass,
  "w-full min-w-0 overflow-hidden",
);

/** Host shell for settings CodeMirror plain-text / prompt editors (same surface as JSON). */
export const settingsPlainTextEditorHostClass = cn(
  fieldSurfaceFocusWithinClass,
  "w-full min-w-0 overflow-hidden",
);

/** Visually hidden native control used to register custom editors with Base UI Field. */
export const settingsFieldHiddenControlClass = cn("sr-only");

/** Base UI Select trigger — replaces native `<select>`. */
export const settingsSelectTriggerClass = cn(
  fieldSurfaceClass,
  fieldDisabledClass,
  "flex h-8 w-full min-w-0 items-center justify-between gap-2 px-2.5 text-left text-xs leading-none text-app-foreground select-none",
  "hover:not-data-disabled:bg-ctp-surface1/40",
  "focus:border-transparent focus-visible:border-badge-background",
  "data-popup-open:border-badge-background data-popup-open:bg-ctp-surface1/40",
);

export const settingsSelectValueClass = cn(
  "min-w-0 flex-1 truncate data-placeholder:text-app-muted",
);

export const settingsSelectIconClass = cn("flex shrink-0 items-center text-sm text-app-muted");

export const settingsSelectPositionerClass = cn("z-settings outline-none");

export const settingsSelectPopupClass = cn(
  "max-h-[min(16rem,var(--available-height))] min-w-(--anchor-width) origin-(--transform-origin) overflow-hidden rounded-lg border border-titlebar-border bg-app-surface text-xs text-app-foreground shadow-quick-pick outline-none app-region-no-drag",
  menuMotionClass,
  "transition-[opacity,scale]",
  "data-starting-style:scale-[0.98] data-starting-style:opacity-0",
  "data-ending-style:scale-[0.98] data-ending-style:opacity-0",
);

export const settingsSelectListClass = cn("max-h-[inherit] overflow-y-auto py-1 outline-none");

export const settingsSelectItemClass = cn(
  "grid cursor-default grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 px-2.5 py-1.5 text-left text-xs leading-tight outline-none select-none",
  "text-app-foreground",
  menuItemHighlightClass,
  menuItemDisabledClass,
);

export const settingsSelectItemIndicatorClass = cn(
  "col-start-1 flex size-4 items-center justify-center text-badge-background",
);

export const settingsSelectItemTextClass = cn("col-start-2 min-w-0 truncate");

/** Base UI Checkbox root. */
export const settingsCheckboxClass = cn(
  "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-sm border border-titlebar-border bg-app-surface text-badge-foreground outline-none",
  "data-checked:border-badge-background data-checked:bg-badge-background",
  controlFocusVisibleInsetClass,
  fieldDisabledClass,
);

export const settingsCheckboxIndicatorClass = cn(
  "flex items-center justify-center data-unchecked:hidden",
);

export const settingsCheckboxLabelClass = cn(
  "flex cursor-pointer items-start gap-1.5 text-2xs text-app-foreground",
  hasDisabledClass,
);

/** Horizontal wrap list for multi-select pill chips (e.g. reasoning levels). */
export const settingsChipListClass = cn("flex flex-wrap gap-1.5");

/** ToggleGroup item shell for a reasoning-level pill — fill-only, field-like surface0. */
export const settingsChipClass = cn(
  "inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-ctp-surface0 px-2.5 text-2xs leading-none text-app-muted outline-none select-none",
  "hover:not-disabled:text-app-foreground",
  "data-pressed:bg-ctp-surface0/80 data-pressed:text-app-foreground",
  controlFocusVisibleInsetClass,
  fieldDisabledClass,
);

/** Selected (available) pill — kept for explicit default/selected class composition. */
export const settingsChipSelectedClass = cn("bg-ctp-surface1/55 text-app-foreground");

/** Selected + default pill chip shell. */
export const settingsChipDefaultClass = cn("bg-badge-background/15 text-badge-background");

/** Hover popover positioner for chip secondary actions. */
export const settingsChipPopoverPositionerClass = cn("z-settings outline-none");

/** Compact hover popover surface for “set default” control. */
export const settingsChipPopoverPanelClass = cn(
  "origin-(--transform-origin) rounded-md border border-titlebar-border bg-app-surface p-1 shadow-context-menu outline-none app-region-no-drag",
  "transition-[opacity,transform] duration-100 ease-out",
  "data-starting-style:scale-[0.98] data-starting-style:opacity-0",
  "data-ending-style:scale-[0.98] data-ending-style:opacity-0",
);

/** “设为默认” control inside the chip hover popover (plain button, not Toggle). */
export const settingsChipDefaultButtonClass = cn(
  "inline-flex h-7 items-center gap-1.5 rounded-sm px-2 text-2xs leading-none text-app-foreground outline-none select-none",
  "hover:not-disabled:bg-ctp-surface0/55",
  controlFocusVisibleInsetClass,
  // Already-default chip action: keep nearly full opacity so “当前默认” stays readable.
  "disabled:cursor-default disabled:opacity-80",
);

/** Compact action cluster for settings headers (save + icon actions). */
export const settingsHeaderActionsClass = cn("flex shrink-0 items-center gap-1.5");

export const settingsFormErrorClass = cn("text-xs text-ctp-red");
