import { cn } from "#app/shared/lib/ui/cn";
import {
  controlFocusVisibleInsetClass,
  fieldInputClass,
  fieldSurfaceClass,
  fieldSurfaceFocusWithinClass,
  iconButtonHoverClass,
  menuItemHighlightClass,
  menuMotionClass,
  overlayOpacityMotionClass,
  panelHoverClass,
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
  "fixed top-1/2 left-1/2 z-settings flex h-[min(70vh,36rem)] w-settings-dialog -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-titlebar-border bg-app-surface text-sm text-app-foreground shadow-quick-pick outline-none app-region-no-drag",
  settingsOverlayTransitionClass,
);

export const settingsHeaderClass = cn(
  "flex shrink-0 items-center justify-between gap-3 border-b border-titlebar-border px-4 py-2.5",
);

export const settingsTitleClass = cn(
  "flex min-w-0 items-center gap-2 font-medium text-app-foreground",
);

export const settingsIconButtonClass = cn(
  "inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-app-muted hover:text-app-foreground",
  iconButtonHoverClass,
);

/** Horizontal bubble tab strip under the dialog header. */
export const settingsTabListClass = cn(
  "flex shrink-0 flex-wrap items-center gap-1.5 border-b border-titlebar-border px-4 py-2.5",
);

/** Inactive bubble tab chip. */
export const settingsTabChipClass = cn(
  "inline-flex h-7 shrink-0 items-center rounded-full border border-titlebar-border bg-app-surface px-2.5 text-2xs leading-none font-medium text-app-muted outline-none select-none",
  "hover:not-disabled:text-app-foreground",
  controlFocusVisibleInsetClass,
);

/** Active bubble tab chip. */
export const settingsTabChipActiveClass = cn(
  "border-badge-background/40 bg-ctp-surface0/55 text-app-foreground",
);

/** Column body under header + tabs — panels own their scrollports. */
export const settingsBodyClass = cn("flex min-h-0 flex-1 flex-col overflow-hidden");

/** Settings main pane shell: fills body; child panels manage header + scroll. */
export const settingsContentClass = cn(
  "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
);

/** Panel root: optional fixed subpage header + independent scroll layers. */
export const settingsPanelRootClass = cn("flex h-full min-h-0 flex-col");

/** Scrollport inside a settings panel (list or subpage form). */
export const settingsPanelScrollClass = cn("min-h-0 flex-1 overflow-x-hidden overflow-y-auto");

/** Fixed subpage navigation bar above the panel scrollport. */
export const settingsSubpageHeaderClass = cn(
  "flex shrink-0 items-center gap-1.5 border-b border-titlebar-border bg-app-surface px-3 py-2",
);

export const settingsSubpageTitleClass = cn(
  "min-w-0 flex-1 truncate text-sm font-medium text-app-foreground",
);

/** Keep-alive list layer while a subpage form is shown. */
export const settingsLayerHiddenClass = cn("hidden");

export const settingsHeaderActionButtonClass = cn(
  "inline-flex size-8 shrink-0 items-center justify-center rounded-sm border border-titlebar-border bg-app-surface text-app-foreground",
  panelHoverClass,
  "disabled:opacity-50",
);

export const settingsPanelSectionClass = cn("flex flex-col gap-3 px-4 py-3");

export const settingsPanelHeaderClass = cn("flex items-start justify-between gap-3");

export const settingsEmptyStateClass = cn(
  "rounded-md border border-dashed border-titlebar-border px-4 py-8 text-center text-xs text-app-muted",
);

export const settingsListClass = cn("flex flex-col gap-2");

export const settingsListItemClass = cn(
  "flex items-start gap-3 rounded-md border border-titlebar-border bg-app-background/40 px-3 py-2.5",
);

export const settingsListItemTitleClass = cn("truncate text-xs font-medium text-app-foreground");

export const settingsListItemMetaClass = cn(
  "mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-2xs text-app-muted",
);

/** Toolbar above multi-select tool cards (count + bulk actions). */
export const settingsToolPickerToolbarClass = cn("flex min-w-0 items-center justify-between gap-2");

export const settingsToolPickerCountClass = cn("text-2xs text-app-muted");

export const settingsToolPickerActionsClass = cn("flex shrink-0 items-center gap-1");

/** Compact text action used for select-all / clear-all style controls. */
export const settingsTextActionButtonClass = cn(
  "inline-flex shrink-0 items-center justify-center rounded-sm px-1.5 py-0.5 text-2xs text-badge-background outline-none",
  "hover:not-disabled:bg-badge-background/10",
  controlFocusVisibleInsetClass,
  "disabled:cursor-default disabled:opacity-40",
);

/** Vertical stack of selectable tool cards. */
export const settingsToolCardListClass = cn("flex flex-col gap-1.5");

/** Selectable tool card shell (label wrapping checkbox + copy). */
export const settingsToolCardClass = cn(
  "flex cursor-pointer items-start gap-2.5 rounded-md border border-titlebar-border bg-app-surface px-2.5 py-2 text-app-foreground outline-none",
  "has-data-disabled:cursor-default has-data-disabled:opacity-50",
  panelHoverClass,
);

/** Selected tool card emphasis. */
export const settingsToolCardSelectedClass = cn("border-badge-background/40 bg-ctp-surface0/40");

export const settingsToolCardBodyClass = cn("min-w-0 flex-1");

export const settingsToolCardTitleClass = cn(
  "truncate text-xs leading-tight font-medium text-app-foreground",
);

export const settingsToolCardDescriptionClass = cn("mt-0.5 text-2xs leading-snug text-app-muted");

export const settingsStatusBadgeClass = cn(
  "inline-flex shrink-0 items-center rounded-sm bg-ctp-surface0/70 px-1.5 py-0.5 text-2xs text-app-muted",
);

export const settingsStatusBadgeDefaultClass = cn("bg-badge-background/20 text-badge-background");

export const settingsFormClass = cn(
  "flex flex-col gap-3 rounded-md border border-titlebar-border bg-app-background/40 p-3",
);

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
  "w-full resize-y px-2.5 py-1.5 text-xs leading-5 text-app-foreground placeholder:text-app-muted disabled:opacity-50",
);

/** Host shell for settings CodeMirror JSON editors (matches textarea chrome). */
export const settingsJsonEditorHostClass = cn(
  fieldSurfaceFocusWithinClass,
  "w-full min-w-0 overflow-hidden",
);

/** Visually hidden native control used to register custom editors with Base UI Field. */
export const settingsFieldHiddenControlClass = cn("sr-only");

/** Base UI Select trigger — replaces native `<select>`. */
export const settingsSelectTriggerClass = cn(
  fieldSurfaceClass,
  "flex h-8 w-full min-w-0 items-center justify-between gap-2 px-2.5 text-left text-xs leading-none text-app-foreground select-none",
  "hover:not-data-disabled:bg-ctp-surface1/40",
  "focus:border-transparent focus-visible:border-badge-background",
  "data-popup-open:border-badge-background data-popup-open:bg-ctp-surface1/40",
  "data-disabled:cursor-default data-disabled:opacity-50",
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
  "data-disabled:cursor-default data-disabled:text-app-muted",
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
  "data-disabled:opacity-50",
);

export const settingsCheckboxIndicatorClass = cn(
  "flex items-center justify-center data-unchecked:hidden",
);

export const settingsCheckboxLabelClass = cn(
  "flex cursor-pointer items-start gap-1.5 text-2xs text-app-foreground",
  "has-data-disabled:cursor-default has-data-disabled:opacity-50",
);

/** Horizontal wrap list for multi-select pill chips (e.g. reasoning levels). */
export const settingsChipListClass = cn("flex flex-wrap gap-1.5");

/** Visual shell for a pill chip (contains body + optional star). */
export const settingsChipClass = cn(
  "inline-flex h-7 shrink-0 items-center rounded-full border border-titlebar-border bg-app-surface text-2xs leading-none text-app-muted select-none",
);

/** Selected (available) pill chip shell. */
export const settingsChipSelectedClass = cn(
  "border-badge-background/40 bg-ctp-surface0/55 text-app-foreground",
);

/** Selected + default pill chip shell. */
export const settingsChipDefaultClass = cn(
  "border-badge-background/55 bg-badge-background/15 text-badge-background",
);

/** Main toggle control inside a chip shell. */
export const settingsChipBodyButtonClass = cn(
  "inline-flex h-7 items-center gap-1 rounded-full px-2.5 outline-none",
  "hover:not-disabled:text-app-foreground",
  controlFocusVisibleInsetClass,
  "disabled:cursor-default",
);

/**
 * Star slot always reserved so selecting a chip does not shift layout.
 * Hosts either the interactive star button or an empty spacer.
 */
export const settingsChipStarSlotClass = cn(
  "mr-1.5 inline-flex size-4 shrink-0 items-center justify-center",
);

/** Nested star control inside a selected chip. */
export const settingsChipStarButtonClass = cn(
  "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] leading-none outline-none",
  "text-app-muted hover:not-disabled:text-badge-background",
  controlFocusVisibleInsetClass,
  "disabled:cursor-default",
);

/** Active default star (filled). */
export const settingsChipStarActiveClass = cn("text-badge-background");

export const settingsFormActionsClass = cn("flex items-center justify-end gap-2");

export const settingsFormErrorClass = cn("text-xs text-ctp-red");

export const settingsPrimaryButtonClass = cn(
  "inline-flex shrink-0 items-center justify-center gap-1 rounded-sm bg-badge-background px-2.5 py-1.5 text-2xs font-medium whitespace-nowrap text-badge-foreground",
  "hover:opacity-90 disabled:opacity-50",
);

export const settingsSecondaryButtonClass = cn(
  "inline-flex items-center justify-center gap-1 rounded-sm border border-titlebar-border bg-app-surface px-2.5 py-1.5 text-2xs text-app-foreground",
  panelHoverClass,
  "disabled:opacity-50",
);
