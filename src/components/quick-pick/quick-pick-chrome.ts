import { cn } from "#app/lib/cn";

export const quickPickPanelClass = cn(
  "fixed top-titlebar left-1/2 z-quick-pick m-0 w-quick-pick overflow-hidden rounded-lg bg-app-surface text-sm text-app-foreground shadow-quick-pick app-region-no-drag",
  "-translate-x-1/2 -translate-y-2 opacity-0 transition transition-discrete duration-220 ease-[cubic-bezier(0.33,1,0.68,1)]",
  "open:-translate-x-1/2 open:translate-y-0 open:opacity-100",
  "open:starting:-translate-x-1/2 open:starting:-translate-y-2 open:starting:opacity-0",
);

export const quickPickPanelHeightShellClass = cn("w-full overflow-hidden");

export const quickPickPanelContentClass = cn("flex max-h-quick-pick-max-height w-full flex-col");

export const quickPickSearchWrapClass = cn("shrink-0 px-2 pt-2 pb-1.5");

export const quickPickSearchInputClass = cn(
  "w-full rounded-sm border border-badge-background bg-workbench-editor px-2 py-1 text-xs leading-tight text-app-foreground outline-none app-region-no-drag placeholder:text-app-muted",
);

export const quickPickListClass = cn(
  "flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pt-0 pb-2 text-xs",
);

export const quickPickRowButtonClass = cn(
  "relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1 text-left text-xs leading-tight outline-none",
);

export const quickPickRowHighlightSurfaceClass = cn(
  "pointer-events-none absolute inset-0 rounded-sm bg-ctp-surface0/55",
);

export const quickPickRowButtonContentClass = cn(
  "relative z-10 flex w-full min-w-0 items-center gap-2",
);

export const quickPickRowEmphasisClass = cn("text-ctp-mauve");

export const quickPickEmptyClass = cn("rounded-sm px-2 py-1 text-app-muted");

/** 列表主项与额外项之间的分隔线，颜色与输入框边框一致。 */
export const quickPickListDividerClass = cn("border-t border-badge-background");

export const quickPickTextInputWrapClass = cn("shrink-0 px-2 pt-2");

export const quickPickTextInputClass = quickPickSearchInputClass;

export const quickPickFooterHintClass = cn(
  "shrink-0 border-t border-badge-background px-3 py-2 text-xs text-app-muted",
);
