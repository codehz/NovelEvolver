import { cn } from "@/lib/cn";

export const branchPickerBackdropClass = cn(
  "fixed inset-0 z-branch-picker bg-ctp-crust/40 app-region-no-drag",
);

export const branchPickerPanelClass = cn(
  "fixed top-titlebar left-1/2 z-branch-picker flex max-h-branch-picker-max-height w-branch-picker -translate-x-1/2 flex-col overflow-hidden rounded-md border border-branch-picker-border bg-branch-picker-surface text-sm text-app-foreground shadow-xl app-region-no-drag",
);

export const branchPickerInputClass = cn(
  "w-full border-0 border-b border-branch-picker-border bg-transparent px-3 py-2 text-sm text-app-foreground outline-none app-region-no-drag placeholder:text-workbench-status-bar-muted",
);

export const branchPickerListClass = cn("min-h-0 flex-1 overflow-y-auto py-1");

export const branchPickerRowClass = cn(
  "flex w-full cursor-default items-center gap-2 px-3 py-1.5 text-left outline-none",
);

export const branchPickerRowHighlightClass = cn("bg-branch-picker-highlight");

export const branchPickerRowCurrentClass = cn("text-workbench-sidebar-title");
