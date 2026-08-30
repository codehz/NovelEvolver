import { cn } from "#app/shared/lib/ui/cn";
import {
  controlFocusVisibleClass,
  listRowHighlightClass,
  menuItemHighlightClass,
  menuMotionClass,
  overlayMotionClass,
  pickerSearchInputClass,
  popoverSurfaceClass,
  rowHoverClass,
} from "#app/shared/lib/ui/interaction-chrome";

export const agentSelectorAnchorClass = cn("relative inline-flex max-w-full min-w-0");

export const modelSelectorAnchorClass = cn("relative inline-flex max-w-full min-w-0");

export const reasoningSelectorAnchorClass = cn("relative inline-flex shrink-0");

export const selectorPositionerClass = cn("z-ai-chat-selector outline-none");

export const selectorPopoverPanelClass = cn(
  "w-ai-chat-selector-picker max-w-[min(18rem,calc(100vw-1rem))] origin-(--transform-origin) shadow-quick-pick outline-none",
  "data-starting-style:translate-y-1 data-starting-style:opacity-0",
  "data-ending-style:translate-y-1 data-ending-style:opacity-0",
  overlayMotionClass,
  popoverSurfaceClass,
);

/** Compact menu panel for reasoning effort levels (no search). */
export const reasoningMenuPanelClass = cn(
  "min-w-28 origin-(--transform-origin) overflow-hidden rounded-lg border border-titlebar-border bg-app-surface py-1 text-xs text-app-foreground shadow-quick-pick outline-none",
  menuMotionClass,
  "data-starting-style:opacity-0",
  "data-ending-style:opacity-0",
);

export const reasoningMenuItemClass = cn(
  "relative flex w-full cursor-default items-center gap-2 px-3 py-1 text-left text-xs leading-tight outline-none select-none",
  "text-app-foreground",
  menuItemHighlightClass,
);

export const reasoningMenuItemActiveClass = cn("text-ctp-mauve");

export const selectorSearchWrapClass = cn("px-2 pt-2 pb-1.5");

export const selectorSearchInputClass = pickerSearchInputClass;

/** Self-clamped picker shell: header fixed, body scrolls within max-height. */
export const selectorPickerShellClass = cn("flex max-h-72 w-full flex-col overflow-hidden");

/** Scrollport under fixed search chrome. */
export const selectorPickerBodyClass = cn("min-h-0 flex-1 overflow-x-hidden overflow-y-auto");

/** List chrome only.
 * No inter-item gap: pointer dead zones between rows reset Combobox highlight to the first item
 * under autoHighlight="always". */
export const selectorListClass = cn("flex flex-col px-1.5 pt-0 pb-1.5");

export const selectorRowButtonClass = cn(
  "relative flex w-full cursor-default flex-col gap-0.5 rounded-sm px-2 py-1.5 text-left outline-none",
  rowHoverClass,
  listRowHighlightClass,
  controlFocusVisibleClass,
  "focus-visible:bg-ctp-surface0/55",
);

export const selectorRowLabelClass = cn("min-w-0 truncate font-medium text-app-foreground");

export const selectorRowDetailClass = cn("min-w-0 truncate text-2xs text-app-muted");

export const selectorRowEmphasisClass = cn("text-ctp-mauve");

export const selectorEmptyClass = cn("rounded-sm p-2 text-app-muted");
