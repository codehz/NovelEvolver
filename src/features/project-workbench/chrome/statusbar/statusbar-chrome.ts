import { cn } from "#app/shared/lib/ui/cn";
import {
  controlFocusVisibleClass,
  iconButtonHoverClass,
} from "#app/shared/lib/ui/interaction-chrome";

/** Interactive status bar segment (encoding, branch, sync, etc.). Flat, no radius; hover wash only. */
export const statusBarItemButtonClass = cn(
  "inline-flex shrink-0 items-center border-0 bg-transparent px-2.5 outline-none select-none",
  "disabled:pointer-events-none disabled:opacity-50",
  iconButtonHoverClass,
  controlFocusVisibleClass,
);

export const statusBarItemButtonWithIconClass = cn(statusBarItemButtonClass, "gap-1.5");

export const statusBarIconOnlyButtonClass = cn(statusBarItemButtonClass, "justify-center");

/** Non-interactive readout (caret line/col, counts). */
export const statusBarItemInfoClass = cn("flex shrink-0 items-center px-2.5");

export const statusBarItemInfoNumericClass = cn(statusBarItemInfoClass, "tabular-nums");

/** Left-side flex message / progress text. */
export const statusBarMessageClass = cn(
  "flex min-w-0 flex-1 items-center truncate px-2.5 text-app-muted",
);
