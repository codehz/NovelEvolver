import { cn } from "#app/shared/lib/ui/cn";

export const settingsPanelClass = cn(
  "flex h-[min(70vh,36rem)] w-settings-dialog flex-col overflow-hidden rounded-md border border-titlebar-border bg-app-surface text-sm text-app-foreground shadow-quick-pick app-region-no-drag",
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

/** Row body under a column flex panel — children stretch for height; do not use ScrollArea `fill` (`h-0`) here. */
export const settingsBodyClass = cn("flex min-h-0 flex-1 overflow-hidden");

export const settingsSidebarClass = cn(
  "h-full min-h-0 w-44 shrink-0 overflow-hidden border-r border-titlebar-border bg-ctp-mantle/40",
);

export const settingsCategoryButtonClass = cn(
  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs leading-tight text-app-muted outline-none",
  "hover:bg-ctp-surface0/40 hover:text-app-foreground",
);

export const settingsCategoryButtonActiveClass = cn(
  "border-l-2 border-badge-background bg-ctp-surface0/35 pl-2.5 text-app-foreground",
);

export const settingsContentClass = cn("h-full min-h-0 min-w-0 flex-1 overflow-hidden");

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

export const settingsFieldLabelClass = cn("py-1.5 text-2xs text-app-muted");

export const settingsInputClass = cn(
  "w-full rounded-sm border border-titlebar-border bg-app-surface px-2.5 py-1.5 text-xs leading-tight text-app-foreground outline-none",
  "placeholder:text-app-muted focus:border-badge-background/60 disabled:opacity-50",
);

export const settingsSelectClass = cn(
  "w-full rounded-sm border border-titlebar-border bg-app-surface px-2 py-1.5 text-xs leading-tight text-app-foreground outline-none",
  "focus:border-badge-background/60 disabled:opacity-50",
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
