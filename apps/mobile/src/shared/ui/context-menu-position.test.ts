// @ts-expect-error Bun test types are intentionally not part of the React Native app tsconfig.
import { describe, expect, test } from "bun:test";

import { resolveContextMenuPlacement } from "./context-menu-position";

const viewport = {
  viewportWidth: 400,
  viewportHeight: 800,
  insets: { top: 24, right: 0, bottom: 20, left: 0 },
};

describe("resolveContextMenuPlacement", () => {
  test("aligns a rectangle menu below its trigger", () => {
    expect(
      resolveContextMenuPlacement({
        ...viewport,
        anchor: { type: "rect", x: 100, y: 100, width: 120, height: 32 },
        menuWidth: 168,
        menuHeight: 140,
      }),
    ).toEqual({ left: 100, top: 136, side: "below" });
  });

  test("flips above a rectangle near the bottom edge", () => {
    expect(
      resolveContextMenuPlacement({
        ...viewport,
        anchor: { type: "rect", x: 80, y: 700, width: 120, height: 32 },
        menuWidth: 168,
        menuHeight: 140,
      }),
    ).toEqual({ left: 80, top: 556, side: "above" });
  });

  test("keeps a point menu inside the right edge", () => {
    expect(
      resolveContextMenuPlacement({
        ...viewport,
        anchor: { type: "point", x: 390, y: 200 },
        menuWidth: 168,
        menuHeight: 100,
      }),
    ).toEqual({ left: 224, top: 204, side: "below" });
  });

  test("respects safe-area margins at the top and left", () => {
    expect(
      resolveContextMenuPlacement({
        viewportWidth: 400,
        viewportHeight: 800,
        insets: { top: 30, right: 0, bottom: 20, left: 12 },
        anchor: { type: "point", x: 0, y: 0 },
        menuWidth: 168,
        menuHeight: 100,
      }),
    ).toEqual({ left: 20, top: 38, side: "below" });
  });
});
