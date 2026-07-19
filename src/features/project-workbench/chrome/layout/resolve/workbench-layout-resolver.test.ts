import { describe, expect, test } from "bun:test";

import {
  ACTIVITY_BAR_WIDTH,
  DEFAULT_AUXILIARY_WIDTH,
  DEFAULT_PRIMARY_WIDTH,
  deriveWorkbenchChromeLayout,
  MIN_AUXILIARY_WIDTH,
  MIN_EDITOR_WIDTH,
  MIN_PRIMARY_WIDTH,
  normalizeSidebarWidth,
  resolveWorkbenchLayout,
  sidebarChromeExtraWidth,
  sidebarChromeOuterSize,
  snapshotLayoutPreferences,
  WORKBENCH_EDGE_INSET,
  type LayoutPreferences,
} from "./workbench-layout-resolver";

const bothOpen: LayoutPreferences = {
  primaryVisible: true,
  primaryWidth: DEFAULT_PRIMARY_WIDTH,
  auxiliaryVisible: true,
  auxiliaryWidth: DEFAULT_AUXILIARY_WIDTH,
  priority: "primary",
};

/** Width large enough for both sidebars at preferred sizes + editor min + chrome. */
function wideContainer(): number {
  return (
    ACTIVITY_BAR_WIDTH +
    WORKBENCH_EDGE_INSET +
    MIN_EDITOR_WIDTH +
    sidebarChromeOuterSize(DEFAULT_PRIMARY_WIDTH) +
    sidebarChromeOuterSize(DEFAULT_AUXILIARY_WIDTH) +
    200
  );
}

describe("normalizeSidebarWidth / sidebarChromeOuterSize", () => {
  test("normalize rounds up to min", () => {
    expect(normalizeSidebarWidth(100, MIN_PRIMARY_WIDTH)).toBe(MIN_PRIMARY_WIDTH);
    expect(normalizeSidebarWidth(300.4, MIN_PRIMARY_WIDTH)).toBe(300);
  });

  test("outer size is panel + sash inset", () => {
    expect(sidebarChromeOuterSize(256)).toBe(256 + sidebarChromeExtraWidth());
  });
});

describe("resolveWorkbenchLayout", () => {
  test("allocates both sides at preferred widths when space is ample", () => {
    const resolved = resolveWorkbenchLayout(bothOpen, wideContainer());
    expect(resolved.primaryVisible).toBe(true);
    expect(resolved.auxiliaryVisible).toBe(true);
    expect(resolved.primaryWidth).toBe(DEFAULT_PRIMARY_WIDTH);
    expect(resolved.auxiliaryWidth).toBe(DEFAULT_AUXILIARY_WIDTH);
  });

  test("priority primary keeps primary when only one sidebar fits", () => {
    // Only room for primary min + chrome after activity + edge + editor min.
    const containerWidth =
      ACTIVITY_BAR_WIDTH +
      WORKBENCH_EDGE_INSET +
      MIN_EDITOR_WIDTH +
      MIN_PRIMARY_WIDTH +
      sidebarChromeExtraWidth() +
      10;
    const resolved = resolveWorkbenchLayout({ ...bothOpen, priority: "primary" }, containerWidth);
    expect(resolved.primaryVisible).toBe(true);
    expect(resolved.auxiliaryVisible).toBe(false);
    expect(resolved.primaryWidth).toBeGreaterThanOrEqual(MIN_PRIMARY_WIDTH);
    expect(resolved.auxiliaryWidth).toBe(0);
  });

  test("priority auxiliary keeps auxiliary when only one sidebar fits", () => {
    const containerWidth =
      ACTIVITY_BAR_WIDTH +
      WORKBENCH_EDGE_INSET +
      MIN_EDITOR_WIDTH +
      MIN_AUXILIARY_WIDTH +
      sidebarChromeExtraWidth() +
      10;
    const resolved = resolveWorkbenchLayout({ ...bothOpen, priority: "auxiliary" }, containerWidth);
    expect(resolved.auxiliaryVisible).toBe(true);
    expect(resolved.primaryVisible).toBe(false);
    expect(resolved.auxiliaryWidth).toBeGreaterThanOrEqual(MIN_AUXILIARY_WIDTH);
    expect(resolved.primaryWidth).toBe(0);
  });

  test("hidden preference stays closed even with ample space", () => {
    const resolved = resolveWorkbenchLayout(
      { ...bothOpen, primaryVisible: false },
      wideContainer(),
    );
    expect(resolved.primaryVisible).toBe(false);
    expect(resolved.primaryWidth).toBe(0);
    expect(resolved.auxiliaryVisible).toBe(true);
  });

  test("clamps preferred width to remaining budget", () => {
    const containerWidth =
      ACTIVITY_BAR_WIDTH +
      WORKBENCH_EDGE_INSET +
      MIN_EDITOR_WIDTH +
      300 +
      sidebarChromeExtraWidth();
    const resolved = resolveWorkbenchLayout(
      {
        primaryVisible: true,
        primaryWidth: 900,
        auxiliaryVisible: false,
        auxiliaryWidth: DEFAULT_AUXILIARY_WIDTH,
        priority: "primary",
      },
      containerWidth,
    );
    expect(resolved.primaryVisible).toBe(true);
    expect(resolved.primaryWidth).toBe(300);
  });

  test("closes when remaining width is below min + chrome", () => {
    const containerWidth = ACTIVITY_BAR_WIDTH + WORKBENCH_EDGE_INSET + MIN_EDITOR_WIDTH + 50;
    const resolved = resolveWorkbenchLayout(bothOpen, containerWidth);
    expect(resolved.primaryVisible).toBe(false);
    expect(resolved.auxiliaryVisible).toBe(false);
  });
});

describe("snapshotLayoutPreferences", () => {
  test("writes resolved widths for visible sides; keeps preferred when closed", () => {
    const preferences: LayoutPreferences = {
      primaryVisible: true,
      primaryWidth: 400,
      auxiliaryVisible: true,
      auxiliaryWidth: 350,
      priority: "primary",
    };
    const resolved = {
      primaryVisible: true,
      primaryWidth: 256,
      auxiliaryVisible: false,
      auxiliaryWidth: 0,
    };
    const snapshot = snapshotLayoutPreferences(preferences, resolved);
    expect(snapshot.primaryVisible).toBe(true);
    expect(snapshot.primaryWidth).toBe(256);
    expect(snapshot.auxiliaryVisible).toBe(false);
    // Closed side keeps the previous preferred width for reopen.
    expect(snapshot.auxiliaryWidth).toBe(350);
    expect(snapshot.priority).toBe("primary");
  });
});

describe("deriveWorkbenchChromeLayout", () => {
  test("visible side uses resolved width and nonzero spacer", () => {
    const chrome = deriveWorkbenchChromeLayout({
      layoutPreferences: bothOpen,
      containerWidth: wideContainer(),
    });
    expect(chrome.primary.visible).toBe(true);
    expect(chrome.primary.panelWidth).toBe(DEFAULT_PRIMARY_WIDTH);
    expect(chrome.primary.spacerWidth).toBe(sidebarChromeOuterSize(DEFAULT_PRIMARY_WIDTH));
    expect(chrome.auxiliary.visible).toBe(true);
    expect(chrome.auxiliary.panelWidth).toBe(DEFAULT_AUXILIARY_WIDTH);
  });

  test("closed side keeps preferred panelWidth with zero spacer", () => {
    const chrome = deriveWorkbenchChromeLayout({
      layoutPreferences: { ...bothOpen, primaryVisible: false, primaryWidth: 280 },
      containerWidth: wideContainer(),
    });
    expect(chrome.primary.visible).toBe(false);
    expect(chrome.primary.spacerWidth).toBe(0);
    // Preferred is retained so reopen knows nominal size.
    expect(chrome.primary.panelWidth).toBe(280);
    expect(chrome.auxiliary.visible).toBe(true);
  });

  test("closed preferred below min is normalized to min", () => {
    const chrome = deriveWorkbenchChromeLayout({
      layoutPreferences: {
        ...bothOpen,
        primaryVisible: false,
        primaryWidth: 100,
      },
      containerWidth: wideContainer(),
    });
    expect(chrome.primary.visible).toBe(false);
    expect(chrome.primary.panelWidth).toBe(MIN_PRIMARY_WIDTH);
  });
});
