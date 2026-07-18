import { cn } from "#app/shared/lib/ui/cn";
import {
  controlDisabledClass,
  controlFocusVisibleClass,
  iconButtonHoverClass,
} from "#app/shared/lib/ui/interaction-chrome";

/** Interactive status bar segment (encoding, branch, sync, etc.). Rounded hover wash. */
export const statusBarItemButtonClass = cn(
  "inline-flex h-full shrink-0 items-center rounded-sm border-0 bg-transparent px-2 outline-none select-none",
  controlDisabledClass,
  iconButtonHoverClass,
  controlFocusVisibleClass,
);

export const statusBarItemButtonWithIconClass = cn(statusBarItemButtonClass, "gap-1.5");

export const statusBarIconOnlyButtonClass = cn(statusBarItemButtonClass, "justify-center");

/** Non-interactive readout (caret line/col, counts). */
export const statusBarItemInfoClass = cn("flex h-full shrink-0 items-center rounded-sm px-2");

export const statusBarItemInfoNumericClass = cn(statusBarItemInfoClass, "tabular-nums");

/** Left-side flex message / progress text. */
export const statusBarMessageClass = cn(
  "flex min-w-0 flex-1 items-center truncate px-2 text-app-muted",
);
