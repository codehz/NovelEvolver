import { cn } from "#app/shared/lib/ui/cn";
import {
  controlFocusVisibleClass,
  listRowHighlightClass,
  overlayMotionClass,
  popoverSurfaceClass,
  rowHoverClass,
} from "#app/shared/lib/ui/interaction-chrome";

/** Host for the CodeMirror composer (replaces the plain textarea shell). */
export const composerEditorHostClass = cn(
  "field-sizing-content max-h-[50vh] min-h-20 w-full overflow-y-auto px-1 py-0.5",
  "text-chat leading-5 text-app-foreground",
  "[&_.cm-editor]:bg-transparent",
  "[&_.cm-editor.cm-focused]:outline-none",
);

export const slashPickerPositionerClass = cn("z-ai-chat-selector outline-none");

export const slashPickerPanelClass = cn(
  "w-ai-chat-selector-picker max-w-[min(18rem,calc(100vw-1rem))] origin-(--transform-origin) shadow-quick-pick outline-none",
  "data-starting-style:translate-y-1 data-starting-style:opacity-0",
  "data-ending-style:translate-y-1 data-ending-style:opacity-0",
  overlayMotionClass,
  popoverSurfaceClass,
);

export const slashPickerShellClass = cn("flex max-h-72 w-full flex-col overflow-hidden");

export const slashPickerBodyClass = cn("min-h-0 flex-1 overflow-x-hidden overflow-y-auto");

export const slashPickerListClass = cn("flex flex-col p-1.5");

export const slashPickerRowClass = cn(
  "relative flex w-full cursor-default flex-col gap-0.5 rounded-sm px-2 py-1.5 text-left outline-none",
  rowHoverClass,
  listRowHighlightClass,
  controlFocusVisibleClass,
  "focus-visible:bg-ctp-surface0/55",
  "data-active:bg-ctp-surface0/55",
);

export const slashPickerLabelClass = cn("min-w-0 truncate font-medium text-app-foreground");

export const slashPickerDetailClass = cn("min-w-0 truncate text-2xs text-app-muted");

export const slashPickerEmptyClass = cn("rounded-sm p-2 text-2xs text-app-muted");

export const slashPickerHeaderClass = cn(
  "border-b border-titlebar-border px-2.5 py-1.5 text-2xs text-app-muted",
);
