import { cn } from "./cn";

export type ScrollEdgeAxis = "x" | "y";

/** Abstract edges relative to scroll start/end (axis-agnostic). */
export type ScrollEdgeMask = "none" | "start" | "end" | "both";

/** Values written to `dataset.edge` for CSS `data-[edge=…]` selectors. */
export type ScrollEdgeDatasetValue = "top" | "bottom" | "left" | "right" | "both";

export type ScrollEdgeFlags = {
  start: boolean;
  end: boolean;
};

/** Match existing live/snippet epsilon for pure scroll geometry. */
export const DEFAULT_SCROLL_EDGE_EPSILON_PX = 0.5;

export type ScrollEdgeFade = "0.75rem" | "1.75rem";

export type BindScrollEdgeMaskOptions = {
  axis?: ScrollEdgeAxis;
  epsilon?: number;
  /** Extra nodes for ResizeObserver (host is always observed). */
  observe?: Element | readonly Element[] | null;
};

function maxScrollForAxis(host: HTMLElement, axis: ScrollEdgeAxis): number {
  if (axis === "x") {
    return Math.max(0, host.scrollWidth - host.clientWidth);
  }
  return Math.max(0, host.scrollHeight - host.clientHeight);
}

function scrollOffsetForAxis(host: HTMLElement, axis: ScrollEdgeAxis): number {
  return axis === "x" ? host.scrollLeft : host.scrollTop;
}

/**
 * Pure scroll geometry → abstract edge mask.
 * `start` means content is clipped before the viewport (can scroll toward start).
 */
export function resolveScrollEdgeMask(
  host: HTMLElement,
  axis: ScrollEdgeAxis,
  epsilon = DEFAULT_SCROLL_EDGE_EPSILON_PX,
): ScrollEdgeMask {
  const maxScroll = maxScrollForAxis(host, axis);
  if (maxScroll <= 0) {
    return "none";
  }
  const offset = scrollOffsetForAxis(host, axis);
  const atStart = offset <= epsilon;
  const atEnd = offset >= maxScroll - epsilon;
  if (!atStart && !atEnd) {
    return "both";
  }
  if (!atStart) {
    return "start";
  }
  if (!atEnd) {
    return "end";
  }
  return "none";
}

/** Map abstract mask + axis to `data-edge` token; `none` → null (attribute removed). */
export function edgeMaskToDatasetValue(
  mask: ScrollEdgeMask,
  axis: ScrollEdgeAxis,
): ScrollEdgeDatasetValue | null {
  if (mask === "none") {
    return null;
  }
  if (mask === "both") {
    return "both";
  }
  if (axis === "y") {
    return mask === "start" ? "top" : "bottom";
  }
  return mask === "start" ? "left" : "right";
}

export function applyScrollEdgeMask(
  host: HTMLElement,
  mask: ScrollEdgeMask,
  axis: ScrollEdgeAxis,
): void {
  const value = edgeMaskToDatasetValue(mask, axis);
  if (value == null) {
    delete host.dataset.edge;
    return;
  }
  host.dataset.edge = value;
}

/** Direct write from external scrollable flags (e.g. ChatScroller content-aware edges). */
export function applyScrollEdgeMaskFromFlags(
  host: HTMLElement,
  flags: ScrollEdgeFlags,
  axis: ScrollEdgeAxis = "y",
): void {
  let mask: ScrollEdgeMask = "none";
  if (flags.start && flags.end) {
    mask = "both";
  } else if (flags.start) {
    mask = "start";
  } else if (flags.end) {
    mask = "end";
  }
  applyScrollEdgeMask(host, mask, axis);
}

function syncFromHost(host: HTMLElement, axis: ScrollEdgeAxis, epsilon: number): void {
  applyScrollEdgeMask(host, resolveScrollEdgeMask(host, axis, epsilon), axis);
}

/**
 * Keep `data-edge` in sync with scroll/resize. Returns dispose that clears listeners and edge.
 */
export function bindScrollEdgeMask(
  host: HTMLElement,
  options: BindScrollEdgeMaskOptions = {},
): () => void {
  const axis = options.axis ?? "y";
  const epsilon = options.epsilon ?? DEFAULT_SCROLL_EDGE_EPSILON_PX;
  const extra =
    options.observe == null
      ? []
      : Array.isArray(options.observe)
        ? options.observe
        : [options.observe];

  const sync = () => {
    syncFromHost(host, axis, epsilon);
  };
  sync();

  const onScroll = () => {
    sync();
  };
  host.addEventListener("scroll", onScroll, { passive: true });

  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(sync);
    resizeObserver.observe(host);
    for (const node of extra) {
      resizeObserver.observe(node);
    }
  }

  return () => {
    host.removeEventListener("scroll", onScroll);
    resizeObserver?.disconnect();
    delete host.dataset.edge;
  };
}

/**
 * Tailwind `data-edge` mask classes for a scroll host.
 * Static strings so oxlint-tailwindcss can validate utilities.
 */
export function scrollEdgeMaskClass(options: {
  axis: ScrollEdgeAxis;
  fade: ScrollEdgeFade;
}): string {
  if (options.axis === "y" && options.fade === "1.75rem") {
    return cn(
      "data-[edge=bottom]:mask-[linear-gradient(to_bottom,black_0%,black_calc(100%-1.75rem),transparent_100%)]",
      "data-[edge=top]:mask-[linear-gradient(to_bottom,transparent_0%,black_1.75rem,black_100%)]",
      "data-[edge=both]:mask-[linear-gradient(to_bottom,transparent_0%,black_1.75rem,black_calc(100%-1.75rem),transparent_100%)]",
    );
  }
  if (options.axis === "x" && options.fade === "0.75rem") {
    return cn(
      "data-[edge=right]:mask-[linear-gradient(to_right,black,black_calc(100%-0.75rem),transparent)]",
      "data-[edge=left]:mask-[linear-gradient(to_right,transparent,black_0.75rem,black)]",
      "data-[edge=both]:mask-[linear-gradient(to_right,transparent,black_0.75rem,black_calc(100%-0.75rem),transparent)]",
    );
  }
  // Fallback for other fade sizes on each axis (static tokens keep lint happy).
  if (options.axis === "y") {
    return cn(
      "data-[edge=bottom]:mask-[linear-gradient(to_bottom,black_0%,black_calc(100%-0.75rem),transparent_100%)]",
      "data-[edge=top]:mask-[linear-gradient(to_bottom,transparent_0%,black_0.75rem,black_100%)]",
      "data-[edge=both]:mask-[linear-gradient(to_bottom,transparent_0%,black_0.75rem,black_calc(100%-0.75rem),transparent_100%)]",
    );
  }
  return cn(
    "data-[edge=right]:mask-[linear-gradient(to_right,black,black_calc(100%-1.75rem),transparent)]",
    "data-[edge=left]:mask-[linear-gradient(to_right,transparent,black_1.75rem,black)]",
    "data-[edge=both]:mask-[linear-gradient(to_right,transparent,black_1.75rem,black_calc(100%-1.75rem),transparent)]",
  );
}
