import { cn } from "@/lib/cn";

/** 透明全屏层：点击外部关闭，无视觉遮罩。 */
export const quickPickDismissLayerClass = cn(
  "fixed inset-0 z-quick-pick bg-transparent app-region-no-drag",
);

export const quickPickPanelClass = cn(
  "fixed top-titlebar left-1/2 z-quick-pick flex max-h-quick-pick-max-height w-quick-pick -translate-x-1/2 flex-col overflow-hidden rounded-lg bg-quick-pick-surface text-sm text-app-foreground shadow-quick-pick app-region-no-drag",
);

export const quickPickSearchWrapClass = cn("shrink-0 px-2 pt-2");

export const quickPickSearchInputClass = cn(
  "w-full rounded-sm border border-badge-background bg-workbench-editor px-2 py-1 text-xs leading-tight text-app-foreground outline-none app-region-no-drag placeholder:text-workbench-status-bar-muted",
);

export const quickPickListClass = cn("min-h-0 flex-1 overflow-y-auto py-0.5 text-xs");

export const quickPickRowButtonClass = cn(
  "flex w-full cursor-default items-center gap-2 px-3 py-1.5 text-left outline-none",
);

export const quickPickRowHighlightClass = cn("bg-quick-pick-highlight");

export const quickPickRowEmphasisClass = cn("text-workbench-sidebar-title");

export const quickPickEmptyClass = cn("px-3 py-2 text-workbench-status-bar-muted");

export const quickPickTextInputWrapClass = cn("shrink-0 px-2 pt-2");

export const quickPickTextInputClass = quickPickSearchInputClass;

export const quickPickFooterHintClass = cn(
  "shrink-0 border-t border-badge-background px-3 py-2 text-xs text-workbench-status-bar-muted",
);
