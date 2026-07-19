import type { ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";

export type TimelineRailItemStatus = "idle" | "running" | "error" | "complete";

export type TimelineRailItem = {
  id: string;
  status: TimelineRailItemStatus;
  content: ReactNode;
};

type TimelineRailProps = {
  items: readonly TimelineRailItem[];
  empty?: ReactNode;
  className?: string;
};

function nodeClass(status: TimelineRailItemStatus): string {
  switch (status) {
    case "error":
      return "relative z-10 mt-1.5 size-1.5 rounded-full bg-ctp-red";
    case "running":
      return "relative z-10 mt-1.5 size-1.5 animate-pulse rounded-full bg-badge-background";
    case "complete":
    case "idle":
      return "relative z-10 mt-1.5 size-1.5 rounded-full bg-ctp-overlay0";
  }
}

/**
 * Vertical timeline rail. Dots + connector sit inside the box so
 * Collapsible.Panel overflow-hidden cannot clip them.
 */
export function TimelineRail({ items, empty, className }: TimelineRailProps): ReactNode {
  if (items.length === 0) {
    return empty != null ? empty : null;
  }

  return (
    <ol className={cn("flex flex-col", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <li key={item.id} className="grid min-w-0 grid-cols-[0.75rem_minmax(0,1fr)] gap-x-2">
            <span className="relative flex justify-center" aria-hidden="true">
              <span
                className={
                  isLast
                    ? "absolute top-0 left-1/2 h-2 w-px -translate-x-1/2 bg-titlebar-border/70"
                    : "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-titlebar-border/70"
                }
              />
              <span className={nodeClass(item.status)} />
            </span>
            <div className={isLast ? "min-w-0" : "min-w-0 pb-1.5"}>{item.content}</div>
          </li>
        );
      })}
    </ol>
  );
}
