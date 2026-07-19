import { describe, expect, test } from "bun:test";

import {
  applyResizeDelta,
  displayHeightsEqual,
  MIN_SIDEBAR_SECTION_BODY_HEIGHT,
  resolveAvailableBodyHeight,
  resolveDisplayHeights,
  resolvePaneHeights,
  scaleHeightsToTotal,
  sum,
} from "./sidebar-pane-geometry";

function pane(
  id: string,
  options: { expanded?: boolean; defaultBodyHeight?: number; minBodyHeight?: number } = {},
) {
  return {
    id,
    expanded: options.expanded ?? true,
    defaultBodyHeight: options.defaultBodyHeight ?? 120,
    minBodyHeight: options.minBodyHeight,
  };
}

describe("sum / scaleHeightsToTotal", () => {
  test("sum empty and values", () => {
    expect(sum([])).toBe(0);
    expect(sum([1, 2, 3])).toBe(6);
  });

  test("scale preserves total with integer floors", () => {
    expect(scaleHeightsToTotal([100, 100], 50)).toEqual([25, 25]);
    expect(sum(scaleHeightsToTotal([10, 20, 30], 100))).toBe(100);
  });

  test("scale to zero clears heights", () => {
    expect(scaleHeightsToTotal([10, 20], 0)).toEqual([0, 0]);
  });
});

describe("resolveAvailableBodyHeight", () => {
  test("subtracts header rows for all panes", () => {
    // 3 headers * 24 = 72
    expect(resolveAvailableBodyHeight(300, 3, 3)).toBe(228);
  });

  test("never negative", () => {
    expect(resolveAvailableBodyHeight(20, 3, 1)).toBe(0);
  });
});

describe("resolvePaneHeights", () => {
  test("single expanded pane fills available budget", () => {
    const { resolvedHeights } = resolvePaneHeights(
      [pane("a", { defaultBodyHeight: 100 })],
      { a: 100 },
      400,
    );
    expect(resolvedHeights).toEqual([400]);
  });

  test("multiple panes respect preferred then remainder on first", () => {
    const { resolvedHeights } = resolvePaneHeights(
      [
        pane("a", { defaultBodyHeight: 100 }),
        pane("b", { defaultBodyHeight: 100 }),
        pane("c", { defaultBodyHeight: 100 }),
      ],
      { a: 100, b: 120, c: 80 },
      400,
    );
    expect(resolvedHeights[0]).toBe(200);
    expect(resolvedHeights[1]).toBe(120);
    expect(resolvedHeights[2]).toBe(80);
    expect(sum(resolvedHeights)).toBe(400);
  });

  test("scales mins when available is too small", () => {
    const { effectiveMinHeights, resolvedHeights } = resolvePaneHeights(
      [pane("a"), pane("b")],
      { a: 200, b: 200 },
      MIN_SIDEBAR_SECTION_BODY_HEIGHT,
    );
    expect(sum(effectiveMinHeights)).toBe(MIN_SIDEBAR_SECTION_BODY_HEIGHT);
    expect(sum(resolvedHeights)).toBe(MIN_SIDEBAR_SECTION_BODY_HEIGHT);
  });
});

describe("resolveDisplayHeights", () => {
  test("collapsed panes are 0; expanded get resolved px", () => {
    const { displayHeights, resolvedHeights } = resolveDisplayHeights(
      [
        pane("a", { expanded: true, defaultBodyHeight: 100 }),
        pane("b", { expanded: false, defaultBodyHeight: 100 }),
        pane("c", { expanded: true, defaultBodyHeight: 100 }),
      ],
      { a: 100, b: 100, c: 100 },
      300,
    );

    expect(displayHeights.b).toBe(0);
    expect(displayHeights.a).toBe(resolvedHeights[0]);
    expect(displayHeights.c).toBe(resolvedHeights[1]);
    // First expanded pane absorbs remainder after lower preferred heights.
    expect(displayHeights.a).toBe(200);
    expect(displayHeights.c).toBe(100);
    expect(displayHeights.a! + displayHeights.c!).toBe(300);
  });

  test("first expanded among remaining absorbs remainder when leading pane collapsed", () => {
    const { displayHeights } = resolveDisplayHeights(
      [
        pane("a", { expanded: false, defaultBodyHeight: 100 }),
        pane("b", { expanded: true, defaultBodyHeight: 100 }),
        pane("c", { expanded: true, defaultBodyHeight: 80 }),
      ],
      { a: 100, b: 100, c: 80 },
      300,
    );

    expect(displayHeights.a).toBe(0);
    expect(displayHeights.b).toBe(220);
    expect(displayHeights.c).toBe(80);
  });

  test("all collapsed yields zero display heights", () => {
    const { displayHeights, resolvedHeights } = resolveDisplayHeights(
      [pane("a", { expanded: false }), pane("b", { expanded: false })],
      {},
      300,
    );
    expect(resolvedHeights).toEqual([]);
    expect(displayHeights).toEqual({ a: 0, b: 0 });
  });
});

describe("applyResizeDelta", () => {
  test("positive delta grows upper pane by shrinking lower", () => {
    const next = applyResizeDelta([100, 100], [40, 40], 0, 30);
    expect(next).toEqual([130, 70]);
  });

  test("negative delta grows lower pane by shrinking upper", () => {
    const next = applyResizeDelta([100, 100], [40, 40], 0, -30);
    expect(next).toEqual([70, 130]);
  });

  test("respects min heights", () => {
    const next = applyResizeDelta([50, 100], [40, 40], 0, 100);
    expect(next[0]).toBe(110);
    expect(next[1]).toBe(40);
  });

  test("zero delta returns same array reference", () => {
    const heights = [100, 100];
    expect(applyResizeDelta(heights, [40, 40], 0, 0)).toBe(heights);
  });
});

describe("displayHeightsEqual", () => {
  test("treats missing keys as 0", () => {
    expect(displayHeightsEqual({ a: 1 }, { a: 1, b: 0 })).toBe(true);
    expect(displayHeightsEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});
