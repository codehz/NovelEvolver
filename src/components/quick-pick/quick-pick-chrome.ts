import { cn } from "@/lib/cn";

/** 透明全屏层：点击外部关闭，无视觉遮罩。 */
export const quickPickDismissLayerClass = cn(
  "fixed inset-0 z-quick-pick bg-transparent app-region-no-drag",
);

export const quickPickPanelClass = cn(
  "fixed top-titlebar left-1/2 z-quick-pick flex max-h-quick-pick-max-height w-quick-pick -translate-x-1/2 flex-col overflow-hidden rounded-lg bg-quick-pick-surface text-sm text-app-foreground shadow-quick-pick app-region-no-drag",
);

export const quickPickSearchWrapClass = cn("shrink-0 px-2 pt-2 pb-1.5");

export const quickPickSearchInputClass = cn(
  "w-full rounded-sm border border-badge-background bg-workbench-editor px-2 py-1 text-xs leading-tight text-app-foreground outline-none app-region-no-drag placeholder:text-workbench-status-bar-muted",
);

export const quickPickListClass = cn(
  "flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pt-0 pb-2 text-xs",
);

export const quickPickRowButtonClass = cn(
  "flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1 text-left text-xs leading-tight outline-none",
);

export const quickPickRowHighlightClass = cn("bg-quick-pick-highlight");

export const quickPickRowEmphasisClass = cn("text-workbench-sidebar-title");

export const quickPickEmptyClass = cn("rounded-sm px-2 py-1 text-workbench-status-bar-muted");

/** 列表主项与额外项之间的分隔线，颜色与输入框边框一致。 */
export const quickPickListDividerClass = cn("border-t border-badge-background");

export const quickPickTextInputWrapClass = cn("shrink-0 px-2 pt-2");

export const quickPickTextInputClass = quickPickSearchInputClass;

export const quickPickFooterHintClass = cn(
  "shrink-0 border-t border-badge-background px-3 py-2 text-xs text-workbench-status-bar-muted",
);
