import { describe, expect, test } from "bun:test";

import {
  displayedEqual,
  holdClosedPanelWidth,
  lerpDisplayed,
  lerpSidebar,
  mergeSide,
  oppositeSide,
  sidebarMetricsEqual,
  stabilizeCloseTargets,
  stabilizeMotionPair,
  stabilizeOpenSources,
  type DisplayedSidebarMetrics,
  type DisplayedWorkbenchChrome,
} from "./workbench-layout-motion";

function metrics(
  partial: Partial<DisplayedSidebarMetrics> & Pick<DisplayedSidebarMetrics, "open">,
): DisplayedSidebarMetrics {
  return {
    spacerWidth: partial.spacerWidth ?? (partial.open ? 264 : 0),
    panelWidth: partial.panelWidth ?? (partial.open ? 256 : 256),
    opacity: partial.opacity ?? (partial.open ? 1 : 0),
    open: partial.open,
  };
}

function chrome(
  primary: DisplayedSidebarMetrics,
  auxiliary: DisplayedSidebarMetrics,
): DisplayedWorkbenchChrome {
  return { primary, auxiliary };
}

describe("stabilizeCloseTargets", () => {
  test("holds from.panelWidth when destination is closed", () => {
    const from = chrome(metrics({ open: true, panelWidth: 220 }), metrics({ open: true }));
    const to = chrome(metrics({ open: false, panelWidth: 400 }), metrics({ open: true }));
    const stabilized = stabilizeCloseTargets(from, to);
    expect(stabilized.primary.open).toBe(false);
    expect(stabilized.primary.panelWidth).toBe(220);
    expect(stabilized.auxiliary).toEqual(to.auxiliary);
  });

  test("leaves open targets unchanged", () => {
    const from = chrome(metrics({ open: false, panelWidth: 200 }), metrics({ open: false }));
    const to = chrome(metrics({ open: true, panelWidth: 256 }), metrics({ open: true }));
    expect(stabilizeCloseTargets(from, to)).toEqual(to);
  });
});

describe("stabilizeOpenSources", () => {
  test("snaps source panelWidth to open target when reopening", () => {
    const from = chrome(
      metrics({ open: false, panelWidth: 400, opacity: 0 }),
      metrics({ open: true }),
    );
    const to = chrome(metrics({ open: true, panelWidth: 256 }), metrics({ open: true }));
    const stabilized = stabilizeOpenSources(from, to);
    expect(stabilized.primary.open).toBe(false);
    expect(stabilized.primary.panelWidth).toBe(256);
    expect(stabilized.primary.opacity).toBe(0);
  });

  test("does not rewrite source when already open", () => {
    const from = chrome(metrics({ open: true, panelWidth: 220 }), metrics({ open: true }));
    const to = chrome(metrics({ open: true, panelWidth: 256 }), metrics({ open: true }));
    expect(stabilizeOpenSources(from, to).primary.panelWidth).toBe(220);
  });
});

describe("stabilizeMotionPair", () => {
  test("close: destination holds current panelWidth", () => {
    const from = chrome(metrics({ open: true, panelWidth: 210 }), metrics({ open: true }));
    const to = chrome(metrics({ open: false, panelWidth: 400 }), metrics({ open: true }));
    const pair = stabilizeMotionPair(from, to);
    expect(pair.to.primary.panelWidth).toBe(210);
    expect(pair.from.primary.panelWidth).toBe(210);
  });

  test("open: source panelWidth snaps to open target", () => {
    const from = chrome(
      metrics({ open: false, panelWidth: 400, opacity: 0 }),
      metrics({ open: true }),
    );
    const to = chrome(metrics({ open: true, panelWidth: 256 }), metrics({ open: true }));
    const pair = stabilizeMotionPair(from, to);
    expect(pair.from.primary.panelWidth).toBe(256);
    expect(pair.to.primary.panelWidth).toBe(256);
  });
});

describe("holdClosedPanelWidth", () => {
  test("keeps base panelWidth when target is closed", () => {
    const base = metrics({ open: true, panelWidth: 222 });
    const target = metrics({ open: false, panelWidth: 400, opacity: 0, spacerWidth: 0 });
    const held = holdClosedPanelWidth(base, target);
    expect(held.open).toBe(false);
    expect(held.panelWidth).toBe(222);
    expect(held.opacity).toBe(0);
  });

  test("returns target unchanged when open", () => {
    const base = metrics({ open: false, panelWidth: 100 });
    const target = metrics({ open: true, panelWidth: 256 });
    expect(holdClosedPanelWidth(base, target)).toEqual(target);
  });
});

describe("lerpSidebar / lerpDisplayed", () => {
  test("lerps numeric fields and tracks destination open intent", () => {
    const from = metrics({ open: true, spacerWidth: 0, panelWidth: 100, opacity: 0 });
    const to = metrics({ open: false, spacerWidth: 200, panelWidth: 200, opacity: 1 });
    const mid = lerpSidebar(from, to, 0.5);
    expect(mid.spacerWidth).toBe(100);
    expect(mid.panelWidth).toBe(150);
    expect(mid.opacity).toBe(0.5);
    expect(mid.open).toBe(false);
  });

  test("lerpDisplayed applies both sides", () => {
    const from = chrome(
      metrics({ open: true, panelWidth: 100, spacerWidth: 100, opacity: 1 }),
      metrics({ open: true, panelWidth: 200, spacerWidth: 200, opacity: 1 }),
    );
    const to = chrome(
      metrics({ open: true, panelWidth: 200, spacerWidth: 200, opacity: 1 }),
      metrics({ open: true, panelWidth: 100, spacerWidth: 100, opacity: 1 }),
    );
    const mid = lerpDisplayed(from, to, 0.5);
    expect(mid.primary.panelWidth).toBe(150);
    expect(mid.auxiliary.panelWidth).toBe(150);
  });
});

describe("equality / merge / opposite", () => {
  test("sidebarMetricsEqual uses width and opacity epsilon", () => {
    const a = metrics({ open: true, panelWidth: 256, spacerWidth: 264, opacity: 1 });
    const b = metrics({ open: true, panelWidth: 256.2, spacerWidth: 264.2, opacity: 1.005 });
    expect(sidebarMetricsEqual(a, b)).toBe(true);
    expect(sidebarMetricsEqual(a, { ...b, open: false })).toBe(false);
  });

  test("displayedEqual requires both sides", () => {
    const a = chrome(metrics({ open: true }), metrics({ open: true }));
    const b = chrome(metrics({ open: true }), metrics({ open: false }));
    expect(displayedEqual(a, a)).toBe(true);
    expect(displayedEqual(a, b)).toBe(false);
  });

  test("oppositeSide and mergeSide", () => {
    expect(oppositeSide("primary")).toBe("auxiliary");
    expect(oppositeSide("auxiliary")).toBe("primary");

    const base = chrome(
      metrics({ open: true, panelWidth: 1 }),
      metrics({ open: true, panelWidth: 2 }),
    );
    const nextPrimary = metrics({ open: false, panelWidth: 9 });
    expect(mergeSide(base, "primary", nextPrimary)).toEqual({
      primary: nextPrimary,
      auxiliary: base.auxiliary,
    });
    const nextAux = metrics({ open: false, panelWidth: 8 });
    expect(mergeSide(base, "auxiliary", nextAux)).toEqual({
      primary: base.primary,
      auxiliary: nextAux,
    });
  });
});
