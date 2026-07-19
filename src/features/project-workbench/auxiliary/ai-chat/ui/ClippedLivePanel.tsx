import { useLayoutEffect, useRef, type ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";

import { liveClipPanelClass } from "./ai-chat-chrome";

type ClippedLivePanelProps = {
  /** When true, clamp height and apply edge-aware mask fade. */
  live: boolean;
  children: ReactNode;
  className?: string;
};

/** Soft edge fade height; keep in sync with liveClipPanelClass mask stops. */
const LIVE_EDGE_EPSILON_PX = 0.5;

type LiveEdgeMask = "none" | "top" | "bottom" | "both";

function liveEdgeMask(host: HTMLElement): LiveEdgeMask {
  const maxScroll = Math.max(0, host.scrollHeight - host.clientHeight);
  if (maxScroll <= 0) {
    return "none";
  }
  const atStart = host.scrollTop <= LIVE_EDGE_EPSILON_PX;
  const atEnd = host.scrollTop >= maxScroll - LIVE_EDGE_EPSILON_PX;
  if (!atStart && !atEnd) {
    return "both";
  }
  if (!atStart) {
    return "top";
  }
  if (!atEnd) {
    return "bottom";
  }
  return "none";
}

function syncLiveEdgeMask(host: HTMLElement): void {
  const edge = liveEdgeMask(host);
  if (edge === "none") {
    delete host.dataset.edge;
    return;
  }
  host.dataset.edge = edge;
}

function isAtLiveBottom(host: HTMLElement): boolean {
  const maxScroll = Math.max(0, host.scrollHeight - host.clientHeight);
  if (maxScroll <= 0) {
    return true;
  }
  return host.scrollTop >= maxScroll - LIVE_EDGE_EPSILON_PX;
}

function scrollLiveToBottom(host: HTMLElement): void {
  const maxScroll = Math.max(0, host.scrollHeight - host.clientHeight);
  if (host.scrollTop !== maxScroll) {
    host.scrollTop = maxScroll;
  }
}

/**
 * Live activity window: max-height + edge-aware mask fade while running.
 * Sticks to bottom on content growth when the user has not scrolled up.
 * Completed / non-live content renders unconstrained (parent collapsible owns height).
 *
 * Only mutates this panel's scrollTop — never scrollIntoView / outer chat scroller.
 */
export function ClippedLivePanel({ live, children, className }: ClippedLivePanelProps): ReactNode {
  const hostRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  useLayoutEffect(() => {
    if (!live) {
      return;
    }

    const host = hostRef.current;
    const content = contentRef.current;
    if (host === null || content === null) {
      return;
    }

    stickToBottomRef.current = true;
    scrollLiveToBottom(host);
    syncLiveEdgeMask(host);

    const onScroll = () => {
      stickToBottomRef.current = isAtLiveBottom(host);
      syncLiveEdgeMask(host);
    };
    host.addEventListener("scroll", onScroll, { passive: true });

    const onResize = () => {
      if (stickToBottomRef.current) {
        scrollLiveToBottom(host);
      }
      syncLiveEdgeMask(host);
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(content);
      resizeObserver.observe(host);
    }

    return () => {
      host.removeEventListener("scroll", onScroll);
      resizeObserver?.disconnect();
      delete host.dataset.edge;
    };
  }, [live]);

  if (!live) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div ref={hostRef} className={cn(liveClipPanelClass, className)}>
      <div ref={contentRef}>{children}</div>
    </div>
  );
}
