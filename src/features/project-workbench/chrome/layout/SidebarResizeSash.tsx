import { memo, type PointerEvent as ReactPointerEvent } from "react";

import { cn } from "#app/shared/lib/ui/cn";

import { WORKBENCH_SIDEBAR_INSET } from "./workbench-layout-resolver";

const sashHostClass = cn(
  "group relative flex h-full shrink-0 cursor-col-resize touch-none items-center justify-center select-none",
);

/** Full-height rail revealed on hover / active drag. */
const sashRailClass = cn(
  "absolute inset-y-1 left-1/2 w-1 -translate-x-1/2 rounded-full bg-ctp-mauve",
  "opacity-0 transition-opacity delay-0 duration-150",
  "group-hover:opacity-100 group-hover:delay-300",
  "group-focus-visible:opacity-100 group-focus-visible:delay-150",
);

/** Three-dot grip visible at rest (hidden while rail is shown). */
const sashGripClass = cn(
  "relative z-10 flex flex-col items-center gap-0.5",
  "transition-opacity delay-0 duration-150",
  "group-hover:opacity-0 group-hover:delay-300",
  "group-focus-visible:opacity-0 group-focus-visible:delay-150",
);

const sashDotClass = cn("size-1 shrink-0 rounded-full bg-ctp-mauve");

type SidebarResizeSashProps = {
  active: boolean;
  ariaLabel: string;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export const SidebarResizeSash = memo(function SidebarResizeSash({
  active,
  ariaLabel,
  onPointerDown,
}: SidebarResizeSashProps) {
  return (
    <div
      aria-label={ariaLabel}
      aria-orientation="vertical"
      className={sashHostClass}
      role="separator"
      style={{ width: WORKBENCH_SIDEBAR_INSET }}
      onPointerDown={onPointerDown}
    >
      <div aria-hidden className={cn(sashRailClass, active && "opacity-100 delay-0")} />
      <div aria-hidden className={cn(sashGripClass, active && "opacity-0 delay-0")}>
        <span className={sashDotClass} />
        <span className={sashDotClass} />
        <span className={sashDotClass} />
      </div>
    </div>
  );
});
