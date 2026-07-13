import { createContext, useContext, type CSSProperties, type ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";

/**
 * Height strategy is required — pick the named entry that matches where height comes from:
 * - `Fill` — definite-height flex column; take remaining space (`h-0 flex-1`)
 * - `Stretch` — parent already sized (or `style.height`); fill with `h-full`
 * - `Max` — self-clamped popover/picker (`max-height`); optional header/footer use internal grid
 *
 * Scrolling is native (`overflow-y-auto`). Electron enables Blink
 * `OverlayScrollbars` so the bar overlays content when the platform supports it.
 *
 * `className` is chrome only (width, border, bg). Do not pass layout height/overflow utilities.
 */

type ScrollAreaChromeProps = {
  id?: string;
  /** Chrome only (width, border, background). Layout height/overflow is owned by the entry. */
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

type ScrollAreaMaxProps = ScrollAreaChromeProps & {
  /** CSS max-height (e.g. `"20rem"` or `320`). Required. */
  height: string | number;
  header?: ReactNode;
  footer?: ReactNode;
};

const scrollAreaFillClass = cn("h-0 min-h-0 flex-1 overflow-hidden");
const scrollAreaStretchClass = cn("h-full min-h-0 overflow-hidden");
const scrollAreaMaxRootClass = cn("grid w-full overflow-hidden");
const scrollAreaMaxTrackClass = cn("min-h-0 overflow-hidden");

/** Fill/Stretch viewport: size-full of a sized parent. */
const scrollAreaViewportClass = cn("size-full min-h-0 overflow-x-hidden overflow-y-auto");

/** Body-only Max: viewport is the clamp root (must shrink with content — no size-full). */
const scrollAreaMaxBodyViewportClass = cn("min-h-0 w-full overflow-x-hidden overflow-y-auto");

const ScrollAreaNestContext = createContext(false);

/** Height/overflow owned by entries; cross-axis flex (`flex-1`, `w-*`) stays allowed on className. */
const LAYOUT_CLASS_RE =
  /\b(?:h-0|h-full|min-h-0|max-h-|overflow-(?:auto|hidden|y-auto|y-scroll))\b/;

function warnMisusedClassName(entry: string, className: string | undefined): void {
  if (process.env.NODE_ENV === "production" || className == null || className === "") {
    return;
  }
  if (LAYOUT_CLASS_RE.test(className)) {
    console.warn(
      `[ScrollArea.${entry}] className should be chrome only; height/overflow layout is owned by the component. Got: ${className}`,
    );
  }
}

function ScrollAreaViewport({
  children,
  className,
  style,
  id,
  fillParent = true,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
  /** When true (default), viewport is size-full of a sized parent. */
  fillParent?: boolean;
}) {
  return (
    <div
      id={id}
      className={cn(
        fillParent ? scrollAreaViewportClass : scrollAreaMaxBodyViewportClass,
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}

function ScrollAreaRoot({
  entry,
  id,
  className,
  style,
  children,
  layoutClassName,
}: ScrollAreaChromeProps & {
  entry: string;
  layoutClassName: string;
}) {
  const nested = useContext(ScrollAreaNestContext);
  if (process.env.NODE_ENV !== "production" && nested) {
    console.warn(
      `[ScrollArea.${entry}] nested inside another ScrollArea. Use sibling surfaces instead.`,
    );
  }
  warnMisusedClassName(entry, className);

  return (
    <ScrollAreaNestContext.Provider value={true}>
      <div className={cn(layoutClassName, className)} id={id} style={style}>
        <ScrollAreaViewport>{children}</ScrollAreaViewport>
      </div>
    </ScrollAreaNestContext.Provider>
  );
}

/** Parent is a definite-height flex column; occupy remaining space. */
function ScrollAreaFill({ id, className, style, children }: ScrollAreaChromeProps) {
  return (
    <ScrollAreaRoot
      entry="Fill"
      id={id}
      className={className}
      style={style}
      layoutClassName={scrollAreaFillClass}
    >
      {children}
    </ScrollAreaRoot>
  );
}

/**
 * Parent already has a definite height (or pass `style.height`).
 * Inline `style.height` overrides the `h-full` utility when set.
 */
function ScrollAreaStretch({ id, className, style, children }: ScrollAreaChromeProps) {
  return (
    <ScrollAreaRoot
      entry="Stretch"
      id={id}
      className={className}
      style={style}
      layoutClassName={scrollAreaStretchClass}
    >
      {children}
    </ScrollAreaRoot>
  );
}

function resolveMaxHeight(height: string | number): string | number {
  return typeof height === "number" ? `${height}px` : height;
}

function maxGridTemplateRows(header: boolean, footer: boolean): string {
  if (header && footer) {
    return "auto minmax(0,1fr) auto";
  }
  if (header) {
    return "auto minmax(0,1fr)";
  }
  if (footer) {
    return "minmax(0,1fr) auto";
  }
  return "minmax(0,1fr)";
}

/**
 * Self-clamped surface (popover / picker). Content shorter than `height` stays short;
 * longer content scrolls. Optional header/footer are fixed chrome outside the viewport.
 */
function ScrollAreaMax({
  id,
  className,
  style,
  children,
  height,
  header,
  footer,
}: ScrollAreaMaxProps) {
  const nested = useContext(ScrollAreaNestContext);
  if (process.env.NODE_ENV !== "production" && nested) {
    console.warn(
      "[ScrollArea.Max] nested inside another ScrollArea. Use sibling surfaces instead.",
    );
  }
  warnMisusedClassName("Max", className);

  const hasChrome = header != null || footer != null;
  const maxHeight = resolveMaxHeight(height);

  if (!hasChrome) {
    return (
      <ScrollAreaNestContext.Provider value={true}>
        <ScrollAreaViewport
          id={id}
          fillParent={false}
          className={className}
          style={{ maxHeight, ...style }}
        >
          {children}
        </ScrollAreaViewport>
      </ScrollAreaNestContext.Provider>
    );
  }

  return (
    <ScrollAreaNestContext.Provider value={true}>
      <div
        className={cn(scrollAreaMaxRootClass, className)}
        id={id}
        style={{
          maxHeight,
          gridTemplateRows: maxGridTemplateRows(header != null, footer != null),
          ...style,
        }}
      >
        {header ?? null}
        <div className={scrollAreaMaxTrackClass}>
          <ScrollAreaViewport>{children}</ScrollAreaViewport>
        </div>
        {footer ?? null}
      </div>
    </ScrollAreaNestContext.Provider>
  );
}

export const ScrollArea = {
  Fill: ScrollAreaFill,
  Stretch: ScrollAreaStretch,
  Max: ScrollAreaMax,
};

export type { ScrollAreaChromeProps, ScrollAreaMaxProps };
