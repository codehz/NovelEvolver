import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { ScrollbarController } from "@/lib/scrollbar";

const scrollAreaRootClass = cn("min-h-0");

const scrollAreaViewportClass = cn(
  "scrollbar-hidden size-full min-h-0 overflow-x-hidden overflow-y-auto",
);

const scrollAreaContentClass = cn("relative");

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
  const viewportRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<ScrollbarController | null>(null);
  const [, setRevision] = useState(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const controller = new ScrollbarController({
      viewport,
      onChange: () => {
        setRevision((n) => n + 1);
      },
    });
    controllerRef.current = controller;

    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  const snapshot = controllerRef.current?.getSnapshot();
  const thumb = snapshot?.thumb ?? null;
  const metrics = snapshot?.metrics ?? null;

  return (
    <div
      className={cn(scrollAreaRootClass, fill && "h-0 flex-1", className)}
      id={id}
      style={style}
      onMouseEnter={() => {
        controllerRef.current?.onAreaPointerEnter();
      }}
      onMouseLeave={() => {
        controllerRef.current?.onAreaPointerLeave();
      }}
    >
      <div ref={viewportRef} className={scrollAreaViewportClass}>
        <div className={scrollAreaContentClass}>
          {thumb ? (
            <div aria-hidden="true" className={scrollAreaStickyRailClass}>
              <div
                className={scrollAreaTrackClass}
                style={{ height: metrics?.clientHeight ?? 0 }}
                onPointerDown={(event) => {
                  controllerRef.current?.onTrackPointerDown(event.nativeEvent);
                }}
              >
                <div
                  className={cn(
                    scrollAreaThumbClass,
                    snapshot?.thumbShown && !snapshot?.thumbActive && scrollAreaThumbPeekClass,
                    snapshot?.thumbActive && scrollAreaThumbActiveClass,
                  )}
                  style={{
                    height: thumb.thumbHeight,
                    transform: `translateY(${thumb.thumbOffset}px)`,
                  }}
                  onMouseEnter={() => {
                    controllerRef.current?.onThumbPointerEnter();
                  }}
                  onMouseLeave={() => {
                    controllerRef.current?.onThumbPointerLeave();
                  }}
                  onPointerDown={(event) => {
                    controllerRef.current?.onThumbPointerDown(event.nativeEvent);
                  }}
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
