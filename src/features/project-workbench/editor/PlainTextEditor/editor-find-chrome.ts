import { cn } from "#app/shared/lib/ui/cn";
import {
  controlFocusVisibleClass,
  fieldSurfaceFocusWithinClass,
  iconButtonHoverClass,
  popoverSurfaceClass,
} from "#app/shared/lib/ui/interaction-chrome";

/** Floating find/replace widget over the editor content. */
export const editorFindBarClass = cn(
  popoverSurfaceClass,
  "absolute top-2 right-3 z-20 w-[min(100%-1.5rem,22rem)] p-1.5 shadow-context-menu",
);

export const editorFindFieldRowClass = cn(
  fieldSurfaceFocusWithinClass,
  "flex h-7 min-w-0 flex-1 items-center gap-1 px-1.5",
);

export const editorFindInputClass = cn(
  "min-h-0 min-w-0 flex-1 border-0 bg-transparent py-0 text-xs leading-none text-app-foreground outline-none placeholder:text-app-muted",
  "appearance-none",
  "[&::-webkit-search-cancel-button]:hidden",
  "[&::-webkit-search-decoration]:hidden",
  "[&::-webkit-search-results-button]:hidden",
);

export const editorFindOptionButtonClass = cn(
  "flex size-5 shrink-0 items-center justify-center rounded-sm text-ctp-overlay0",
  "hover:bg-ctp-surface1 hover:text-ctp-subtext1",
  controlFocusVisibleClass,
);

export const editorFindOptionPressedClass = cn(
  "data-pressed:bg-ctp-blue/20 data-pressed:text-ctp-blue",
  "hover:data-pressed:bg-ctp-blue/25 hover:data-pressed:text-ctp-blue",
);

export const editorFindIconButtonClass = cn(editorFindOptionButtonClass, iconButtonHoverClass);

export const editorFindStatsClass = cn(
  "min-w-10 shrink-0 px-0.5 text-right text-2xs text-ctp-subtext0 tabular-nums",
);

export const editorFindReplaceToggleClass = cn(
  "flex w-4 shrink-0 items-center justify-center self-stretch rounded-sm p-0 text-ctp-overlay0",
  iconButtonHoverClass,
  controlFocusVisibleClass,
);

export const editorFindRowClass = cn("flex min-w-0 items-center gap-1");
