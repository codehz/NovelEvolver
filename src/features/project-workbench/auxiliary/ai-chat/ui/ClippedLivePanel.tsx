import { useLayoutEffect, useRef, type ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import {
  bindScrollEdgeMask,
  DEFAULT_SCROLL_EDGE_EPSILON_PX,
} from "#app/shared/lib/ui/scroll-edge-mask";

import { liveClipPanelClass } from "./ai-chat-chrome";

type ClippedLivePanelProps = {
  /** When true, clamp height and apply edge-aware mask fade. */
  live: boolean;
  children: ReactNode;
  className?: string;
};

function isAtLiveBottom(host: HTMLElement): boolean {
  const maxScroll = Math.max(0, host.scrollHeight - host.clientHeight);
  if (maxScroll <= 0) {
    return true;
  }
  return host.scrollTop >= maxScroll - DEFAULT_SCROLL_EDGE_EPSILON_PX;
}

/**
 * Live activity window: max-height + edge-aware mask fade while running.
 * Sticks to bottom on content growth while stick is armed.
 *
 * Stick is driven by **user scroll intent**, not absolute position on every
 * scroll event: programmatic pin + collapsible expand can leave intermediate
 * frames not-at-bottom and used to clear stick permanently.
 * - wheel/touch up → unstick
 * - wheel/touch down onto bottom (or scrollbar drag to bottom) → re-stick
 *
 * Only mutates this panel's scrollTop — never scrollIntoView / outer chat scroller.
 */
export function ClippedLivePanel({ live, children, className }: ClippedLivePanelProps): ReactNode {
  const hostRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const suppressScrollRef = useRef(false);
  const touchStartYRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!live) {
      return;
    }

    const host = hostRef.current;
    const content = contentRef.current;
    if (host === null || content === null) {
      return;
    }

    let suppressClearRaf = 0;

    const pinToBottom = () => {
      const maxScroll = Math.max(0, host.scrollHeight - host.clientHeight);
      if (host.scrollTop === maxScroll) {
        return;
      }
      suppressScrollRef.current = true;
      host.scrollTop = maxScroll;
      if (suppressClearRaf !== 0) {
        window.cancelAnimationFrame(suppressClearRaf);
      }
      suppressClearRaf = window.requestAnimationFrame(() => {
        suppressClearRaf = 0;
        suppressScrollRef.current = false;
        // After programmatic pin settles, re-read in case layout still moved.
        if (
          stickToBottomRef.current &&
          host.scrollTop !== Math.max(0, host.scrollHeight - host.clientHeight)
        ) {
          suppressScrollRef.current = true;
          host.scrollTop = Math.max(0, host.scrollHeight - host.clientHeight);
          suppressClearRaf = window.requestAnimationFrame(() => {
            suppressClearRaf = 0;
            suppressScrollRef.current = false;
          });
        }
      });
    };

    stickToBottomRef.current = true;
    pinToBottom();

    const disposeEdgeMask = bindScrollEdgeMask(host, {
      axis: "y",
      observe: content,
    });

    // Scrollbar-drag fallback only. Programmatic pin is suppressed; do not use
    // absolute position as the primary unstick path (expand frames desync).
    const onScroll = () => {
      if (suppressScrollRef.current) {
        return;
      }
      stickToBottomRef.current = isAtLiveBottom(host);
    };
    host.addEventListener("scroll", onScroll, { passive: true });

    const onWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) {
        stickToBottomRef.current = false;
        return;
      }
      if (event.deltaY > 0) {
        window.requestAnimationFrame(() => {
          if (isAtLiveBottom(host)) {
            stickToBottomRef.current = true;
          }
        });
      }
    };
    host.addEventListener("wheel", onWheel, { passive: true });

    const onTouchStart = (event: TouchEvent) => {
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (event: TouchEvent) => {
      const startY = touchStartYRef.current;
      const currentY = event.touches[0]?.clientY;
      if (startY == null || currentY == null) {
        return;
      }
      const deltaY = currentY - startY;
      // Finger up → content moves down → user reading earlier content.
      if (deltaY > 2) {
        stickToBottomRef.current = false;
        return;
      }
      if (deltaY < -2) {
        window.requestAnimationFrame(() => {
          if (isAtLiveBottom(host)) {
            stickToBottomRef.current = true;
          }
        });
      }
    };
    const onTouchEnd = () => {
      touchStartYRef.current = null;
    };
    host.addEventListener("touchstart", onTouchStart, { passive: true });
    host.addEventListener("touchmove", onTouchMove, { passive: true });
    host.addEventListener("touchend", onTouchEnd, { passive: true });
    host.addEventListener("touchcancel", onTouchEnd, { passive: true });

    const onResize = () => {
      if (stickToBottomRef.current) {
        pinToBottom();
      }
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(content);
      resizeObserver.observe(host);
    }

    return () => {
      host.removeEventListener("scroll", onScroll);
      host.removeEventListener("wheel", onWheel);
      host.removeEventListener("touchstart", onTouchStart);
      host.removeEventListener("touchmove", onTouchMove);
      host.removeEventListener("touchend", onTouchEnd);
      host.removeEventListener("touchcancel", onTouchEnd);
      if (suppressClearRaf !== 0) {
        window.cancelAnimationFrame(suppressClearRaf);
      }
      resizeObserver?.disconnect();
      disposeEdgeMask();
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
