import { cn } from "@/lib/cn";

export const sidebarHeaderActionClass = cn(
  "inline-flex size-6 shrink-0 items-center justify-center rounded border-0 bg-transparent p-0",
  "text-workbench-sidebar-title hover:bg-window-button-hover hover:text-workbench-sidebar-title",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-badge-background",
);

export const sidebarHeaderIconClass = cn(
  "inline-flex size-4 shrink-0 items-center justify-center text-base leading-none",
);
