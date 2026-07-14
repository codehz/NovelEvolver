import { cn } from "#app/shared/lib/ui/cn";

export const quickPickPanelClass = cn(
  "fixed top-titlebar left-1/2 z-quick-pick m-0 w-quick-pick -translate-x-1/2 overflow-hidden rounded-lg bg-app-surface text-sm text-app-foreground shadow-quick-pick outline-none app-region-no-drag",
  "transition-[opacity,translate] duration-220 ease-[cubic-bezier(0.33,1,0.68,1)]",
  "data-starting-style:-translate-y-2 data-starting-style:opacity-0",
  "data-ending-style:-translate-y-2 data-ending-style:opacity-0",
);

export const quickPickPanelContentClass = cn("flex w-full flex-col");

export const quickPickSearchWrapClass = cn("px-2 pt-2 pb-1.5");

export const quickPickSearchInputClass = cn(
  "w-full rounded-sm border border-badge-background bg-app-background px-2 py-1 text-xs leading-tight text-app-foreground outline-none app-region-no-drag placeholder:text-app-muted",
);

/** Self-clamped list scrollport (search stays outside). */
export const quickPickListScrollClass = cn("max-h-80 w-full overflow-x-hidden overflow-y-auto");

/** List chrome only. Collapse when empty so Empty doesn't leave a flex gap.
 * No inter-item gap: pointer dead zones between rows reset Combobox highlight to the first item
 * under autoHighlight="always". */
export const quickPickListClass = cn("flex flex-col px-2 pt-0 pb-2 text-xs", "data-empty:hidden");

export const quickPickRowButtonClass = cn(
  "relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1 text-left text-xs leading-tight outline-none",
  "data-highlighted:bg-ctp-surface0/55",
);

export const quickPickRowEmphasisClass = cn("text-ctp-mauve");

export const quickPickEmptyClass = cn("rounded-sm px-2 py-1 pb-2 text-app-muted");

/** 列表主项与额外项之间的分隔线，颜色与输入框边框一致。 */
export const quickPickListDividerClass = cn("border-t border-badge-background");

export const quickPickTextInputWrapClass = cn("shrink-0 px-2 pt-2");

export const quickPickTextInputClass = quickPickSearchInputClass;

export const quickPickFooterHintClass = cn(
  "shrink-0 border-t border-badge-background px-3 py-2 text-xs text-app-muted",
);
