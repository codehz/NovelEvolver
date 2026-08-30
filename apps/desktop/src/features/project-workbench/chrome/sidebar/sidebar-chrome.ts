import { cn } from "#app/shared/lib/ui/cn";
import {
  controlDisabledSoftClass,
  controlFocusVisibleClass,
  iconButtonHoverClass,
} from "#app/shared/lib/ui/interaction-chrome";

// --- Floating sidebar surface (VS Code modern UI) ---

/** Card shell for primary / auxiliary sidebars: border, radius, clip. */
export const sidebarPanelSurfaceClass = cn(
  "overflow-hidden rounded-lg border border-titlebar-border bg-app-surface",
);

// --- View header (primary / auxiliary top chrome row) ---

/** Sidebar top chrome row — VS Code view title (2xs uppercase; not section headers). */
export const sidebarChromeTitleTextClass = cn(
  "truncate text-2xs font-medium tracking-wide text-ctp-mauve uppercase",
);

export const sidebarHeaderActionClass = cn(
  "inline-flex size-6 shrink-0 items-center justify-center rounded border-0 bg-transparent p-0",
  "text-ctp-mauve hover:text-ctp-mauve",
  controlDisabledSoftClass,
  iconButtonHoverClass,
  controlFocusVisibleClass,
);

export const sidebarHeaderIconClass = cn(
  "inline-flex size-4 shrink-0 items-center justify-center text-base leading-none",
);

// --- Section header (collapsible panels inside sidebar body) ---

// Section Header 应该是白色加粗文字和主题色按钮的，不要在这里加 text-ctp-mauve。
// Overrides shared Button defaults (justify-center, shrink-0, size sm padding, ghost hover).
export const sidebarSectionHeaderButtonClass = cn(
  "flex h-6 w-auto min-w-0 flex-1 shrink items-center justify-start gap-0.5 rounded-none bg-app-surface px-0.5 py-0 text-left",
  "text-2xs font-semibold tracking-wide text-app-foreground uppercase",
  "hover:bg-transparent hover:text-app-foreground",
  controlFocusVisibleClass,
);

export const sidebarSectionHeaderChevronClass = cn(
  "inline-flex shrink-0 items-center justify-center text-base leading-none text-ctp-mauve",
);

// --- Section resize (horizontal seam between stacked panes) ---

export const sidebarSectionResizeSeamClass = cn("relative z-20 h-0 shrink-0");

/** Narrow hit target: ~4px above the seam, ~4px below; rail on the seam (upper side). */
export const sidebarSectionResizeHandleClass = cn(
  "group absolute inset-x-0 top-0 z-20 h-2 -translate-y-1 cursor-row-resize touch-none select-none",
);

export const sidebarSectionResizeRailClass = cn(
  "h-1 w-full shrink-0 bg-ctp-mauve opacity-0 transition-opacity delay-0 duration-150",
  "group-hover:opacity-100 group-hover:delay-300 group-focus-visible:opacity-100 group-focus-visible:delay-150",
);
