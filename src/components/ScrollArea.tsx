import { type CSSProperties, type ReactNode } from "react";

import { cn } from "#app/lib/cn";
import {
  scrollbarHiddenViewportClass,
  scrollbarStickyRailClass,
  ScrollbarThumbTrack,
  useScrollbarController,
} from "#app/lib/scrollbar";

const scrollAreaRootClass = cn("min-h-0");

const scrollAreaContentClass = cn("relative");

export function ScrollArea({
  id,
  className,
  style,
  children,
  fill,
}: {
  id?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  /** When true, participate in flex column growth (sidebar section body). */
  fill?: boolean;
}) {
  const {
    viewportRef,
    snapshot,
    onAreaPointerEnter,
    onAreaPointerLeave,
    onTrackPointerDown,
    onThumbPointerEnter,
    onThumbPointerLeave,
    onThumbPointerDown,
  } = useScrollbarController();

  const thumb = snapshot?.thumb ?? null;
  const metrics = snapshot?.metrics ?? null;

  return (
    <div
      className={cn(scrollAreaRootClass, fill && "h-0 flex-1", className)}
      id={id}
      style={style}
      onMouseEnter={onAreaPointerEnter}
      onMouseLeave={onAreaPointerLeave}
    >
      <div ref={viewportRef} className={scrollbarHiddenViewportClass}>
        <div className={scrollAreaContentClass}>
          {thumb && metrics && snapshot ? (
            <div aria-hidden="true" className={scrollbarStickyRailClass}>
              <ScrollbarThumbTrack
                snapshot={snapshot}
                metrics={metrics}
                thumb={thumb}
                onTrackPointerDown={onTrackPointerDown}
                onThumbPointerEnter={onThumbPointerEnter}
                onThumbPointerLeave={onThumbPointerLeave}
                onThumbPointerDown={onThumbPointerDown}
              />
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
