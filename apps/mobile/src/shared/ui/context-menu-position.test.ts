// @ts-expect-error Bun test types are intentionally not part of the React Native app tsconfig.
import { describe, expect, test } from "bun:test";

import { resolveContextMenuPlacement, resolveContextMenuWidth } from "./context-menu-position";

const viewport = {
  viewportWidth: 400,
  viewportHeight: 800,
  insets: { top: 24, right: 0, bottom: 20, left: 0 },
};

describe("resolveContextMenuWidth", () => {
  test("uses the preferred minimum width for a control anchor", () => {
    expect(
      resolveContextMenuWidth({
        anchor: { x: 100, y: 100, width: 32, height: 32 },
        preferredMinimumWidth: 280,
        viewportWidth: 400,
        insets: { left: 0, right: 0 },
      }),
    ).toEqual({ minWidth: 280, maxWidth: 384 });
  });

  test("matches a wider rectangle trigger", () => {
    expect(
      resolveContextMenuWidth({
        anchor: { x: 20, y: 100, width: 300, height: 32 },
        preferredMinimumWidth: 168,
        viewportWidth: 400,
        insets: { left: 0, right: 0 },
      }),
    ).toEqual({ minWidth: 300, maxWidth: 384 });
  });

  test("shrinks the minimum width to the safe-area width", () => {
    expect(
      resolveContextMenuWidth({
        anchor: { x: 100, y: 100, width: 32, height: 32 },
        preferredMinimumWidth: 280,
        viewportWidth: 280,
        insets: { left: 12, right: 12 },
      }),
    ).toEqual({ minWidth: 240, maxWidth: 240 });
  });
});

describe("resolveContextMenuPlacement", () => {
  test("aligns a rectangle menu below its trigger", () => {
    expect(
      resolveContextMenuPlacement({
        ...viewport,
        anchor: { x: 100, y: 100, width: 120, height: 32 },
        menuWidth: 168,
        menuHeight: 140,
      }),
    ).toEqual({ left: 100, top: 136, side: "below" });
  });

  test("flips above a rectangle near the bottom edge", () => {
    expect(
      resolveContextMenuPlacement({
        ...viewport,
        anchor: { x: 80, y: 700, width: 120, height: 32 },
        menuWidth: 168,
        menuHeight: 140,
      }),
    ).toEqual({ left: 80, top: 556, side: "above" });
  });

  test("flips above whenever the menu does not fit below", () => {
    expect(
      resolveContextMenuPlacement({
        ...viewport,
        anchor: { x: 80, y: 350, width: 120, height: 32 },
        menuWidth: 168,
        menuHeight: 430,
      }),
    ).toEqual({ left: 80, top: 32, side: "above" });
  });

  test("keeps a control-anchored menu inside the right edge", () => {
    expect(
      resolveContextMenuPlacement({
        ...viewport,
        anchor: { x: 390, y: 200, width: 24, height: 32 },
        menuWidth: 168,
        menuHeight: 100,
      }),
    ).toEqual({ left: 224, top: 236, side: "below" });
  });

  test("respects safe-area margins at the top and left", () => {
    expect(
      resolveContextMenuPlacement({
        viewportWidth: 400,
        viewportHeight: 800,
        insets: { top: 30, right: 0, bottom: 20, left: 12 },
        anchor: { x: 0, y: 0, width: 32, height: 32 },
        menuWidth: 168,
        menuHeight: 100,
      }),
    ).toEqual({ left: 20, top: 38, side: "below" });
  });
});
