import { cn } from "#app/shared/lib/ui/cn";

export const settingsBackdropClass = cn(
  "fixed inset-0 z-settings m-0 cursor-default border-0 bg-ctp-crust/55 p-0 app-region-no-drag",
);

export const settingsPanelClass = cn(
  "fixed top-1/2 left-1/2 z-settings m-0 flex h-[min(70vh,36rem)] max-h-[calc(100vh-5rem)] w-settings-dialog max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-md border border-titlebar-border bg-app-surface text-sm text-app-foreground shadow-quick-pick app-region-no-drag",
  "opacity-0 transition transition-discrete duration-220 ease-[cubic-bezier(0.33,1,0.68,1)]",
  "open:opacity-100",
  "open:starting:opacity-0",
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

export const settingsBodyClass = cn("flex min-h-0 flex-1");

export const settingsSidebarClass = cn(
  "flex w-44 shrink-0 flex-col border-r border-titlebar-border bg-ctp-mantle/40",
);

export const settingsCategoryButtonClass = cn(
  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs leading-tight text-app-muted outline-none",
  "hover:bg-ctp-surface0/40 hover:text-app-foreground",
);

export const settingsCategoryButtonActiveClass = cn(
  "border-l-2 border-badge-background bg-ctp-surface0/35 pl-2.5 text-app-foreground",
);

export const settingsContentClass = cn("flex min-h-0 min-w-0 flex-1 flex-col");

export const settingsPlaceholderClass = cn(
  "flex flex-1 items-center justify-center px-6 py-10 text-xs text-app-muted",
);

export const settingsHeaderActionButtonClass = cn(
  "inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-titlebar-border bg-app-surface text-app-foreground",
  "hover:bg-ctp-surface0/40 disabled:opacity-50",
);
