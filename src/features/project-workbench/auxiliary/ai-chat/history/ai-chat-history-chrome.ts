import { cn } from "#app/shared/lib/ui/cn";

const historyPanelSurfaceClass = cn(
  "overflow-hidden rounded-lg border border-titlebar-border bg-app-surface text-xs text-app-foreground shadow-quick-pick app-region-no-drag",
);

export const historyPositionerClass = cn("z-ai-chat-selector outline-none");

export const historyPopoverPanelClass = cn(
  "w-ai-chat-history-picker max-w-[min(22rem,calc(100vw-1rem))] origin-(--transform-origin) outline-none",
  "transition-[opacity,translate] duration-220 ease-[cubic-bezier(0.33,1,0.68,1)]",
  "data-starting-style:translate-y-1 data-starting-style:opacity-0",
  "data-ending-style:translate-y-1 data-ending-style:opacity-0",
  historyPanelSurfaceClass,
);

/** max-h body: grid minmax(0,1fr) gives ScrollArea a definite height (flex+`fill` won't). */
export const historyPanelContentClass = cn(
  "grid max-h-80 w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden",
);

export const historySearchWrapClass = cn("px-2 pt-2 pb-1.5");

export const historySearchInputClass = cn(
  "w-full rounded-sm border border-badge-background bg-app-background px-2 py-1 text-xs leading-tight text-app-foreground outline-none app-region-no-drag placeholder:text-app-muted",
);

export const historyListClass = cn("flex flex-col gap-0.5 px-1.5 pt-0 pb-1.5");

export const historyGroupLabelClass = cn(
  "px-2 pt-1.5 pb-0.5 text-2xs font-medium tracking-wide text-app-muted uppercase",
);

export const historyRowButtonClass = cn(
  "relative flex w-full cursor-default flex-col gap-0.5 rounded-sm px-2 py-1.5 text-left outline-none",
  "hover:bg-ctp-surface0/55",
  "focus-visible:bg-ctp-surface0/55 focus-visible:ring-1 focus-visible:ring-ctp-mauve/50",
);

export const historyRowHighlightedClass = cn("bg-ctp-surface0/55");

export const historyRowEmphasisClass = cn("text-ctp-mauve");

export const historyRowMutedClass = cn("opacity-70");

export const historyRowLabelClass = cn("min-w-0 truncate font-medium text-app-foreground");

export const historyRowMetaClass = cn("flex min-w-0 items-center gap-1.5 pl-5");

export const historyRowDetailClass = cn("min-w-0 truncate text-2xs text-app-muted");

export const historyBadgeClass = cn(
  "shrink-0 rounded-sm bg-ctp-surface0 px-1 py-px text-2xs text-app-muted",
);

export const historyEmptyClass = cn("rounded-sm p-2 text-app-muted");

export const historyFooterClass = cn(
  "flex items-center justify-between gap-2 border-t border-titlebar-border px-2 py-1.5",
);

export const historyFooterToggleClass = cn(
  "inline-flex items-center gap-1.5 rounded-sm px-1 py-0.5 text-2xs text-app-muted outline-none",
  "hover:bg-ctp-surface0/55 hover:text-app-foreground",
  "focus-visible:ring-1 focus-visible:ring-ctp-mauve/50",
);

export const historyRenameInputClass = cn(
  "w-full rounded-sm border border-badge-background bg-app-background px-1.5 py-0.5 text-xs text-app-foreground outline-none",
  "focus-visible:ring-1 focus-visible:ring-ctp-mauve/50",
);
