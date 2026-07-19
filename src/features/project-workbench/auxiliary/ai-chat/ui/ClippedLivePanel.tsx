import type { ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";

import { liveClipPanelClass } from "./ai-chat-chrome";

type ClippedLivePanelProps = {
  /** When true, clamp height and fade the bottom edge. */
  live: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * Live activity window: max-height + bottom mask fade while running.
 * Completed / non-live content renders unconstrained (parent collapsible owns height).
 */
export function ClippedLivePanel({ live, children, className }: ClippedLivePanelProps): ReactNode {
  if (!live) {
    return <div className={className}>{children}</div>;
  }

  return <div className={cn(liveClipPanelClass, className)}>{children}</div>;
}
