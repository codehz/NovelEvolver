import { cn } from "#app/shared/lib/ui/cn";
import {
  controlFocusVisibleClass,
  iconButtonHoverClass,
} from "#app/shared/lib/ui/interaction-chrome";

/** Card shell for the center editor group: border, radius, clip (matches sidebars). */
export const editorPanelSurfaceClass = cn(
  "overflow-hidden rounded-lg border border-titlebar-border bg-app-background",
);

/** Tab strip inside the editor card — no strip fill; chips carry their own surface. */
export const editorTabBarClass = cn(
  "flex h-workbench-tab shrink-0 items-center gap-1 overflow-x-auto px-1.5",
);

/** Shared geometry for an editor tab chip. */
export const editorTabClass = cn(
  "group relative flex h-7 max-w-xs shrink-0 cursor-pointer items-center rounded-md pr-1 pl-2.5 text-sm",
  controlFocusVisibleClass,
);

export const editorTabActiveClass = cn("bg-ctp-surface0 text-app-foreground");

export const editorTabInactiveClass = cn(
  "text-ctp-subtext0 hover:bg-ctp-text/8 hover:text-app-foreground",
);

export const editorTabCloseButtonClass = cn(
  "rounded p-0.5 text-[15px] text-ctp-overlay1 opacity-0 transition-opacity",
  "group-hover:opacity-100 hover:text-app-foreground",
  iconButtonHoverClass,
);

export const editorTabCloseButtonActiveClass = cn("opacity-100");

export const editorBreadcrumbRowClass = cn(
  "flex h-8 shrink-0 items-center gap-1 bg-app-background px-3 text-xs text-ctp-subtext0",
);

export const editorPaneDeckClass = cn("flex min-h-0 min-w-0 flex-1 flex-col bg-app-background");
