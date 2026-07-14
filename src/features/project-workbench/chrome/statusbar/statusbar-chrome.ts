import { cn } from "#app/shared/lib/ui/cn";

/** Interactive status bar segment (encoding, branch, sync, etc.). */
export const statusBarItemButtonClass = cn(
  "flex shrink-0 items-center px-2.5 hover:bg-ctp-text/8 hover:text-app-foreground",
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
