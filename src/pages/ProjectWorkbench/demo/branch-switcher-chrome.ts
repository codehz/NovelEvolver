import { cn } from "@/lib/cn";

/** 透明全屏层：仅用于点击外部关闭，无视觉遮罩。 */
export const branchPickerDismissLayerClass = cn(
  "fixed inset-0 z-branch-picker bg-transparent app-region-no-drag",
);

export const branchPickerPanelClass = cn(
  "fixed top-titlebar left-1/2 z-branch-picker flex max-h-branch-picker-max-height w-branch-picker -translate-x-1/2 flex-col overflow-hidden rounded-lg bg-branch-picker-surface text-sm text-app-foreground shadow-branch-picker app-region-no-drag",
);

export const branchPickerInputWrapClass = cn("shrink-0 px-2 pt-2");

export const branchPickerInputClass = cn(
  "w-full rounded-sm border border-badge-background bg-workbench-editor px-2 py-1 text-xs leading-tight text-app-foreground outline-none app-region-no-drag placeholder:text-workbench-status-bar-muted",
);

export const branchPickerListClass = cn("min-h-0 flex-1 overflow-y-auto py-0.5 text-xs");

export const branchPickerRowClass = cn(
  "flex w-full cursor-default items-center gap-2 px-3 py-1.5 text-left outline-none",
);

export const branchPickerRowHighlightClass = cn("bg-branch-picker-highlight");

export const branchPickerRowCurrentClass = cn("text-workbench-sidebar-title");
