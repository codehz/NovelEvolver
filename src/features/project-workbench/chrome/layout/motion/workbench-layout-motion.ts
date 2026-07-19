import type {
  SidebarChromeMetrics,
  WorkbenchChromeLayout,
} from "../resolve/workbench-layout-resolver";

export type WorkbenchLayoutPhase = "idle" | "dragging" | "animating";

export type DisplayedSidebarMetrics = {
  spacerWidth: number;
  panelWidth: number;
  opacity: number;
  /** Semantic open intent (target visible), not mid-lerp opacity. */
  open: boolean;
};

export type DisplayedWorkbenchChrome = {
  primary: DisplayedSidebarMetrics;
  auxiliary: DisplayedSidebarMetrics;
};

export type WorkbenchLayoutSide = keyof DisplayedWorkbenchChrome;

/** Matches previous CSS `duration-200 ease-out`. */
export const WORKBENCH_LAYOUT_MOTION = {
  duration: 0.2,
  ease: "easeOut" as const,
};

const WIDTH_EPSILON = 0.5;
const OPACITY_EPSILON = 0.01;

export function sidebarMetricsFromChrome(metrics: SidebarChromeMetrics): DisplayedSidebarMetrics {
  return {
    spacerWidth: metrics.spacerWidth,
    panelWidth: metrics.panelWidth,
    opacity: metrics.visible ? 1 : 0,
    open: metrics.visible,
  };
}

export function targetsFromChromeLayout(chrome: WorkbenchChromeLayout): DisplayedWorkbenchChrome {
  return {
    primary: sidebarMetricsFromChrome(chrome.primary),
    auxiliary: sidebarMetricsFromChrome(chrome.auxiliary),
  };
}

/**
 * When a sidebar is closed, chrome metrics fall back to *preferred* panel width
 * (so reopen knows the nominal size). That preferred belongs to the resolver /
 * preference layer only — it must not become the displayed closed width.
 * Preferred can be larger than the currently displayed width if the dock was
 * squeezed; lerping panelWidth toward preferred would expand the panel while
 * fading out (or grow under the editor after opacity hits 0).
 *
 * Hold the current panelWidth whenever the destination is closed. Pair with
 * `stabilizeOpenSources` (or `stabilizeMotionPair`) so reopen does not animate
 * from preferred down to the constrained open target.
 */
export function stabilizeCloseTargets(
  from: DisplayedWorkbenchChrome,
  to: DisplayedWorkbenchChrome,
): DisplayedWorkbenchChrome {
  return {
    primary: stabilizeCloseSide(from.primary, to.primary),
    auxiliary: stabilizeCloseSide(from.auxiliary, to.auxiliary),
  };
}

/**
 * When reopening, snap the lerp *source* panelWidth to the open target so only
 * spacer/opacity animate. Avoids preferred → constrained shrink on reopen.
 * Spacer/opacity still start from the closed values (typically 0).
 */
export function stabilizeOpenSources(
  from: DisplayedWorkbenchChrome,
  to: DisplayedWorkbenchChrome,
): DisplayedWorkbenchChrome {
  return {
    primary: stabilizeOpenSourceSide(from.primary, to.primary),
    auxiliary: stabilizeOpenSourceSide(from.auxiliary, to.auxiliary),
  };
}

/**
 * Destination close-hold + open-source panel snap for a full motion pair.
 * Prefer this at animation entry points so neither end is forgotten.
 */
export function stabilizeMotionPair(
  from: DisplayedWorkbenchChrome,
  to: DisplayedWorkbenchChrome,
): { from: DisplayedWorkbenchChrome; to: DisplayedWorkbenchChrome } {
  const stabilizedTo = stabilizeCloseTargets(from, to);
  return {
    from: stabilizeOpenSources(from, stabilizedTo),
    to: stabilizedTo,
  };
}

/**
 * Drag-snap helper: when the target is closed, keep `base.panelWidth` instead of
 * writing the resolver's preferred closed width into displayed metrics.
 */
export function holdClosedPanelWidth(
  base: DisplayedSidebarMetrics,
  target: DisplayedSidebarMetrics,
): DisplayedSidebarMetrics {
  if (!target.open) {
    return {
      ...target,
      panelWidth: base.panelWidth,
    };
  }
  return target;
}

function stabilizeCloseSide(
  from: DisplayedSidebarMetrics,
  to: DisplayedSidebarMetrics,
): DisplayedSidebarMetrics {
  if (!to.open) {
    return {
      ...to,
      panelWidth: from.panelWidth,
    };
  }
  return to;
}

function stabilizeOpenSourceSide(
  from: DisplayedSidebarMetrics,
  to: DisplayedSidebarMetrics,
): DisplayedSidebarMetrics {
  if (!from.open && to.open) {
    return {
      ...from,
      panelWidth: to.panelWidth,
    };
  }
  return from;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function lerpSidebar(
  from: DisplayedSidebarMetrics,
  to: DisplayedSidebarMetrics,
  t: number,
): DisplayedSidebarMetrics {
  return {
    spacerWidth: lerp(from.spacerWidth, to.spacerWidth, t),
    panelWidth: lerp(from.panelWidth, to.panelWidth, t),
    opacity: lerp(from.opacity, to.opacity, t),
    // Intent tracks the destination so visibility-flip detection stays stable mid-lerp.
    open: to.open,
  };
}

export function lerpDisplayed(
  from: DisplayedWorkbenchChrome,
  to: DisplayedWorkbenchChrome,
  t: number,
): DisplayedWorkbenchChrome {
  return {
    primary: lerpSidebar(from.primary, to.primary, t),
    auxiliary: lerpSidebar(from.auxiliary, to.auxiliary, t),
  };
}

export function sidebarMetricsEqual(
  a: DisplayedSidebarMetrics,
  b: DisplayedSidebarMetrics,
): boolean {
  return (
    Math.abs(a.spacerWidth - b.spacerWidth) < WIDTH_EPSILON &&
    Math.abs(a.panelWidth - b.panelWidth) < WIDTH_EPSILON &&
    Math.abs(a.opacity - b.opacity) < OPACITY_EPSILON &&
    a.open === b.open
  );
}

export function displayedEqual(a: DisplayedWorkbenchChrome, b: DisplayedWorkbenchChrome): boolean {
  return sidebarMetricsEqual(a.primary, b.primary) && sidebarMetricsEqual(a.auxiliary, b.auxiliary);
}

export function oppositeSide(side: WorkbenchLayoutSide): WorkbenchLayoutSide {
  return side === "primary" ? "auxiliary" : "primary";
}

export function mergeSide(
  base: DisplayedWorkbenchChrome,
  side: WorkbenchLayoutSide,
  metrics: DisplayedSidebarMetrics,
): DisplayedWorkbenchChrome {
  if (side === "primary") {
    return { primary: metrics, auxiliary: base.auxiliary };
  }
  return { primary: base.primary, auxiliary: metrics };
}
