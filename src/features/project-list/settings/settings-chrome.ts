import { cn } from "#app/shared/lib/ui/cn";

const settingsOverlayTransitionClass = cn(
  "transition-opacity duration-220 ease-[cubic-bezier(0.33,1,0.68,1)]",
  "data-ending-style:opacity-0 data-starting-style:opacity-0",
);

export const settingsBackdropClass = cn(
  "fixed inset-0 z-settings min-h-dvh bg-ctp-crust/55",
  settingsOverlayTransitionClass,
);

export const settingsPanelClass = cn(
  "fixed top-1/2 left-1/2 z-settings flex h-[min(70vh,36rem)] w-settings-dialog -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-md border border-titlebar-border bg-app-surface text-sm text-app-foreground shadow-quick-pick outline-none app-region-no-drag",
  settingsOverlayTransitionClass,
);

export const settingsHeaderClass = cn(
  "flex shrink-0 items-center justify-between gap-3 border-b border-titlebar-border px-4 py-2.5",
);

export const settingsTitleClass = cn(
  "flex min-w-0 items-center gap-2 font-medium text-app-foreground",
);

export const settingsIconButtonClass = cn(
  "inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-app-muted hover:bg-ctp-text/8 hover:text-app-foreground",
);

export const settingsSearchWrapClass = cn("shrink-0 border-b border-titlebar-border px-4 py-2.5");

export const settingsSearchInputClass = cn(
  "w-full rounded-sm border border-titlebar-border bg-app-background px-2.5 py-1.5 text-xs leading-tight text-app-foreground outline-none placeholder:text-app-muted",
);

/** Row body under a column flex panel — pair with `ScrollArea.Stretch` children. */
export const settingsBodyClass = cn("flex min-h-0 flex-1 overflow-hidden");

/** Chrome for settings nav — height/overflow owned by `ScrollArea.Stretch`. */
export const settingsSidebarClass = cn(
  "w-44 shrink-0 border-r border-titlebar-border bg-ctp-mantle/40",
);

export const settingsCategoryButtonClass = cn(
  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs leading-tight text-app-muted outline-none",
  "hover:bg-ctp-surface0/40 hover:text-app-foreground",
);

export const settingsCategoryButtonActiveClass = cn(
  "border-l-2 border-badge-background bg-ctp-surface0/35 pl-2.5 text-app-foreground",
);

/** Chrome for settings main pane — height/overflow owned by `ScrollArea.Stretch`. */
export const settingsContentClass = cn("min-w-0 flex-1");

export const settingsPlaceholderClass = cn(
  "flex min-h-40 items-center justify-center px-6 py-10 text-xs text-app-muted",
);

export const settingsHeaderActionButtonClass = cn(
  "inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-titlebar-border bg-app-surface text-app-foreground",
  "hover:bg-ctp-surface0/40 disabled:opacity-50",
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

export const settingsFieldLabelClass = cn("py-1.5 text-2xs text-app-muted");

export const settingsFieldDescriptionClass = cn("text-2xs text-app-muted");

export const settingsFieldErrorClass = cn("text-2xs text-ctp-red");

export const settingsInputClass = cn(
  "w-full rounded-sm border border-titlebar-border bg-app-surface px-2.5 py-1.5 text-xs leading-tight text-app-foreground outline-none",
  "placeholder:text-app-muted focus:border-badge-background/60 disabled:opacity-50",
);

/** Base UI Select trigger — replaces native `<select>`. */
export const settingsSelectTriggerClass = cn(
  "flex w-full min-w-0 items-center justify-between gap-2 rounded-sm border border-titlebar-border bg-app-surface px-2.5 py-1.5 text-left text-xs leading-tight text-app-foreground outline-none select-none",
  "hover:not-data-disabled:bg-ctp-surface0/30",
  "focus-visible:border-badge-background/60",
  "data-popup-open:border-badge-background/60 data-popup-open:bg-ctp-surface0/30",
  "data-disabled:cursor-default data-disabled:opacity-50",
);

export const settingsSelectValueClass = cn(
  "min-w-0 flex-1 truncate data-placeholder:text-app-muted",
);

export const settingsSelectIconClass = cn("flex shrink-0 items-center text-sm text-app-muted");

export const settingsSelectPositionerClass = cn("z-settings outline-none");

export const settingsSelectPopupClass = cn(
  "max-h-[min(16rem,var(--available-height))] min-w-(--anchor-width) origin-(--transform-origin) overflow-hidden rounded-md border border-titlebar-border bg-app-surface text-xs text-app-foreground shadow-quick-pick outline-none app-region-no-drag",
  "transition-[opacity,scale] duration-120 ease-[cubic-bezier(0.33,1,0.68,1)]",
  "data-starting-style:scale-[0.98] data-starting-style:opacity-0",
  "data-ending-style:scale-[0.98] data-ending-style:opacity-0",
);

export const settingsSelectListClass = cn("max-h-[inherit] overflow-y-auto py-1 outline-none");

export const settingsSelectItemClass = cn(
  "grid cursor-default grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 px-2.5 py-1.5 text-left text-xs leading-tight outline-none select-none",
  "text-app-foreground data-highlighted:bg-ctp-surface0/70",
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
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-badge-background/70",
  "data-disabled:opacity-50",
);

export const settingsCheckboxIndicatorClass = cn(
  "flex items-center justify-center data-unchecked:hidden",
);

export const settingsCheckboxLabelClass = cn(
  "flex cursor-pointer items-start gap-1.5 text-2xs text-app-foreground",
  "has-data-disabled:cursor-default has-data-disabled:opacity-50",
);

export const settingsFormActionsClass = cn("flex items-center justify-end gap-2");

export const settingsFormErrorClass = cn("text-xs text-ctp-red");

export const settingsPrimaryButtonClass = cn(
  "inline-flex shrink-0 items-center justify-center gap-1 rounded-sm bg-badge-background px-2.5 py-1.5 text-2xs font-medium whitespace-nowrap text-badge-foreground",
  "hover:opacity-90 disabled:opacity-50",
);

export const settingsSecondaryButtonClass = cn(
  "inline-flex items-center justify-center gap-1 rounded-sm border border-titlebar-border bg-app-surface px-2.5 py-1.5 text-2xs text-app-foreground",
  "hover:bg-ctp-surface0/40 disabled:opacity-50",
);
