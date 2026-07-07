import { cn } from "#app/lib/cn";

const sidebarChromeFocusVisibleClass = cn(
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-badge-background",
);

// --- View header (primary / auxiliary top chrome row) ---

/** Primary sidebar top chrome row — VS Code view title (2xs uppercase; not section headers). */
export const primarySidebarChromeTitleTextClass = cn(
  "truncate text-2xs font-medium tracking-wide text-ctp-mauve uppercase",
);

export const sidebarHeaderActionClass = cn(
  "inline-flex size-6 shrink-0 items-center justify-center rounded border-0 bg-transparent p-0",
  "text-ctp-mauve hover:bg-ctp-text/8 hover:text-ctp-mauve",
  "disabled:pointer-events-none disabled:opacity-40",
  sidebarChromeFocusVisibleClass,
);

export const sidebarHeaderIconClass = cn(
  "inline-flex size-4 shrink-0 items-center justify-center text-base leading-none",
);

// --- Section header (collapsible panels inside sidebar body) ---

// Section Header 应该是白色加粗文字和主题色按钮的，不要在这里加 text-ctp-mauve
export const sidebarSectionHeaderButtonClass = cn(
  "flex h-6 min-w-0 flex-1 items-center gap-0.5 bg-app-surface px-0.5 text-left",
  "text-2xs font-semibold tracking-wide uppercase",
  sidebarChromeFocusVisibleClass,
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
