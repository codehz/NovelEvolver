import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/cn";

const SCROLLBAR_HIDE_DELAY_MS = 400;
const MIN_THUMB_HEIGHT_PX = 24;

const scrollAreaRootClass = cn("min-h-0");

const scrollAreaViewportClass = cn(
  "scrollbar-hidden size-full min-h-0 overflow-x-hidden overflow-y-auto",
);

const scrollAreaContentClass = cn("relative");

const scrollAreaContentGutterClass = cn("pr-workbench-scrollbar");

/** Pins the scrollbar rail to the scrollport while keeping it inside the scrollable viewport (wheel works over the track). */
const scrollAreaStickyRailClass = cn("pointer-events-none sticky top-0 z-10 h-0 w-full");

const scrollAreaTrackClass = cn(
  "pointer-events-auto absolute top-0 right-0 z-10 w-workbench-scrollbar",
);

const scrollAreaThumbClass = cn(
  "absolute inset-x-0 top-0 rounded-none bg-workbench-scrollbar-thumb opacity-0",
  "transition-opacity delay-400 duration-300 ease-out",
);

/** Shown while pointer is in the scroll area, scrolling, or dragging (subdued). */
const scrollAreaThumbPeekClass = cn("opacity-40 delay-0");

/** Pointer over the thumb or actively dragging. */
const scrollAreaThumbActiveClass = cn("bg-workbench-scrollbar-thumb-hover opacity-100 delay-0");

type ScrollMetrics = {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
};

function computeThumb(metrics: ScrollMetrics) {
  const { clientHeight, scrollHeight, scrollTop } = metrics;
  if (scrollHeight <= clientHeight || clientHeight <= 0) {
    return null;
  }

  const maxScroll = scrollHeight - clientHeight;
  const thumbHeight = Math.max(MIN_THUMB_HEIGHT_PX, (clientHeight / scrollHeight) * clientHeight);
  const trackRange = clientHeight - thumbHeight;
  const thumbOffset = maxScroll > 0 ? (scrollTop / maxScroll) * trackRange : 0;

  return { thumbHeight, thumbOffset };
}

function readMetrics(viewport: HTMLElement): ScrollMetrics {
  return {
    clientHeight: viewport.clientHeight,
    scrollHeight: viewport.scrollHeight,
    scrollTop: viewport.scrollTop,
  };
}

export function ScrollArea({
  id,
  className,
  style,
  children,
  fill,
  reserveScrollbarGutter,
}: {
  id?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  /** When true, participate in flex column growth (sidebar section body). */
  fill?: boolean;
  /** Reserve right padding matching the custom scrollbar width so content is not covered. */
  reserveScrollbarGutter?: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStateRef = useRef<{ startY: number; startScrollTop: number } | null>(null);
  const areaHoverRef = useRef(false);

  const [metrics, setMetrics] = useState<ScrollMetrics | null>(null);
  const [scrollbarShown, setScrollbarShown] = useState(false);
  const [areaHover, setAreaHover] = useState(false);
  const [thumbHover, setThumbHover] = useState(false);
  const [dragging, setDragging] = useState(false);

  const refreshMetrics = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    setMetrics(readMetrics(viewport));
  }, []);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setScrollbarShown(false);
      hideTimerRef.current = null;
    }, SCROLLBAR_HIDE_DELAY_MS);
  }, []);

  const showScrollbar = useCallback(() => {
    setScrollbarShown(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    refreshMetrics();

    const observer = new ResizeObserver(() => {
      refreshMetrics();
    });
    observer.observe(viewport);

    return () => {
      observer.disconnect();
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [refreshMetrics]);

  const onViewportScroll = useCallback(() => {
    refreshMetrics();
    showScrollbar();
  }, [refreshMetrics, showScrollbar]);

  const thumb = metrics ? computeThumb(metrics) : null;
  const thumbShown = Boolean(thumb && (areaHover || dragging || scrollbarShown));
  const thumbActive = dragging || thumbHover;

  const onTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport || !thumb || event.target !== event.currentTarget) {
      return;
    }

    const trackRect = event.currentTarget.getBoundingClientRect();
    const clickOffset = event.clientY - trackRect.top;
    const maxScroll = viewport.scrollHeight - viewport.clientHeight;
    const trackRange = viewport.clientHeight - thumb.thumbHeight;
    const nextOffset = Math.min(Math.max(clickOffset - thumb.thumbHeight / 2, 0), trackRange);
    const ratio = trackRange > 0 ? nextOffset / trackRange : 0;
    viewport.scrollTop = ratio * maxScroll;
    showScrollbar();
  };

  const onThumbPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      startY: event.clientY,
      startScrollTop: viewport.scrollTop,
    };
    setDragging(true);
    setScrollbarShown(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const onThumbPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const drag = dragStateRef.current;
    if (!viewport || !drag || !thumb) {
      return;
    }

    const maxScroll = viewport.scrollHeight - viewport.clientHeight;
    const trackRange = viewport.clientHeight - thumb.thumbHeight;
    if (trackRange <= 0 || maxScroll <= 0) {
      return;
    }

    const deltaY = event.clientY - drag.startY;
    const scrollDelta = (deltaY / trackRange) * maxScroll;
    viewport.scrollTop = drag.startScrollTop + scrollDelta;
    refreshMetrics();
  };

  const endThumbDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) {
      return;
    }
    dragStateRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!areaHoverRef.current) {
      scheduleHide();
    }
  };

  const onAreaMouseEnter = () => {
    areaHoverRef.current = true;
    setAreaHover(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const onAreaMouseLeave = () => {
    areaHoverRef.current = false;
    setAreaHover(false);
    setThumbHover(false);
    if (!dragStateRef.current) {
      scheduleHide();
    }
  };

  return (
    <div
      className={cn(scrollAreaRootClass, fill && "h-0 flex-1", className)}
      id={id}
      style={style}
      onMouseEnter={onAreaMouseEnter}
      onMouseLeave={onAreaMouseLeave}
    >
      <div ref={viewportRef} className={scrollAreaViewportClass} onScroll={onViewportScroll}>
        <div
          className={cn(
            scrollAreaContentClass,
            reserveScrollbarGutter && scrollAreaContentGutterClass,
          )}
        >
          {thumb ? (
            <div aria-hidden="true" className={scrollAreaStickyRailClass}>
              <div
                className={scrollAreaTrackClass}
                style={{ height: metrics?.clientHeight ?? 0 }}
                onPointerDown={onTrackPointerDown}
              >
                <div
                  className={cn(
                    scrollAreaThumbClass,
                    thumbShown && !thumbActive && scrollAreaThumbPeekClass,
                    thumbActive && scrollAreaThumbActiveClass,
                  )}
                  style={{
                    height: thumb.thumbHeight,
                    transform: `translateY(${thumb.thumbOffset}px)`,
                  }}
                  onMouseEnter={() => {
                    setThumbHover(true);
                  }}
                  onMouseLeave={() => {
                    setThumbHover(false);
                  }}
                  onPointerDown={onThumbPointerDown}
                  onPointerMove={onThumbPointerMove}
                  onPointerUp={endThumbDrag}
                  onPointerCancel={endThumbDrag}
                />
              </div>
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
