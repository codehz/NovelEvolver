import { cn } from "#app/lib/cn";

/** Primary sidebar top chrome row — VS Code view title (2xs uppercase; not section headers). */
export const primarySidebarChromeTitleTextClass = cn(
  "truncate text-2xs font-medium tracking-wide text-workbench-sidebar-title uppercase",
);

/** Collapsible panel section header label inside the sidebar body. */
export const sidebarSectionHeaderTitleTypographyClass = cn(
  "text-2xs font-semibold tracking-wide uppercase",
);

export const sidebarHeaderActionClass = cn(
  "inline-flex size-6 shrink-0 items-center justify-center rounded border-0 bg-transparent p-0",
  "text-workbench-sidebar-action hover:bg-window-button-hover hover:text-workbench-sidebar-action",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-badge-background",
);

export const sidebarHeaderIconClass = cn(
  "inline-flex size-4 shrink-0 items-center justify-center text-base leading-none",
);
