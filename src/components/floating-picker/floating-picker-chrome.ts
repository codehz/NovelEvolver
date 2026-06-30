import { cn } from "@/lib/cn";

/** 透明全屏层：点击外部关闭，无视觉遮罩。 */
export const floatingPickerDismissLayerClass = cn(
  "fixed inset-0 z-floating-picker bg-transparent app-region-no-drag",
);

export const floatingPickerPanelBaseClass = cn(
  "fixed z-floating-picker flex flex-col overflow-hidden rounded-lg bg-floating-picker-surface text-sm text-app-foreground shadow-floating-picker app-region-no-drag",
);

/** 标题栏下方水平居中（命令面板 / Quick Pick）。 */
export const floatingPickerPanelCenteredClass = cn(
  "top-titlebar left-1/2 max-h-floating-picker-max-height w-floating-picker -translate-x-1/2",
);

export const floatingPickerInputWrapClass = cn("shrink-0 px-2 pt-2");

export const floatingPickerInputClass = cn(
  "w-full rounded-sm border border-badge-background bg-workbench-editor px-2 py-1 text-xs leading-tight text-app-foreground outline-none app-region-no-drag placeholder:text-workbench-status-bar-muted",
);

export const floatingPickerListClass = cn("min-h-0 flex-1 overflow-y-auto py-0.5 text-xs");

export const floatingPickerRowClass = cn(
  "flex w-full cursor-default items-center gap-2 px-3 py-1.5 text-left outline-none",
);

export const floatingPickerRowHighlightClass = cn("bg-floating-picker-highlight");

export const floatingPickerRowEmphasisClass = cn("text-workbench-sidebar-title");

export const floatingPickerEmptyStateClass = cn("px-3 py-2 text-workbench-status-bar-muted");
