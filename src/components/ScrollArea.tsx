import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import {
  ScrollbarController,
  scrollbarHiddenViewportClass,
  scrollbarStickyRailClass,
  scrollbarThumbClassName,
  scrollbarTrackClass,
} from "@/lib/scrollbar";

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
    controller.refreshMetrics();

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
      <div ref={viewportRef} className={scrollbarHiddenViewportClass}>
        <div className={scrollAreaContentClass}>
          {thumb ? (
            <div aria-hidden="true" className={scrollbarStickyRailClass}>
              <div
                className={scrollbarTrackClass}
                style={{ height: metrics?.clientHeight ?? 0 }}
                onPointerDown={(event) => {
                  controllerRef.current?.onTrackPointerDown(event.nativeEvent);
                }}
              >
                <div
                  className={scrollbarThumbClassName(snapshot!)}
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
