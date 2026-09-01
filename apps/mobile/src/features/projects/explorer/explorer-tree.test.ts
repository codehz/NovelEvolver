// @ts-expect-error Bun test types are intentionally not part of the React Native app tsconfig.
import { describe, expect, test } from "bun:test";

import { resolveHoverZone } from "./explorer-tree-drop";
import { visualExplorerRowSlots } from "./explorer-tree-flatten";
import {
  explorerTreeActionCenterX,
  explorerTreeActionTooltipPlacement,
  explorerTreeDragZoneKey,
  resolveExplorerTreeDragZone,
} from "./explorer-tree-gesture";

const ROW_HEIGHT = 48;

describe("resolveHoverZone", () => {
  test("splits a row into before / inside / after", () => {
    expect(resolveHoverZone(0, ROW_HEIGHT)).toBe("before");
    expect(resolveHoverZone(ROW_HEIGHT * 0.24, ROW_HEIGHT)).toBe("before");
    expect(resolveHoverZone(ROW_HEIGHT * 0.5, ROW_HEIGHT)).toBe("inside");
    expect(resolveHoverZone(ROW_HEIGHT * 0.76, ROW_HEIGHT)).toBe("after");
  });
});

describe("resolveExplorerTreeDragZone", () => {
  const input = {
    rowTop: ROW_HEIGHT * 2,
    rowHeight: ROW_HEIGHT,
    listWidth: 320,
    actionWidth: 64,
    actionGap: 8,
    actionRightMargin: 8,
  };

  test("shows rename and delete zones at the right edge of the source row", () => {
    expect(resolveExplorerTreeDragZone({ ...input, x: 167, y: input.rowTop + 24 })).toEqual({
      kind: "inside",
    });
    expect(resolveExplorerTreeDragZone({ ...input, x: 200, y: input.rowTop + 24 })).toEqual({
      kind: "action",
      action: "rename",
    });
    expect(resolveExplorerTreeDragZone({ ...input, x: 244, y: input.rowTop + 24 })).toEqual({
      kind: "inside",
    });
    expect(resolveExplorerTreeDragZone({ ...input, x: 270, y: input.rowTop + 24 })).toEqual({
      kind: "action",
      action: "delete",
    });
    expect(resolveExplorerTreeDragZone({ ...input, x: 315, y: input.rowTop + 24 })).toEqual({
      kind: "inside",
    });
  });

  test("treats every direction outside the source row as outside", () => {
    expect(resolveExplorerTreeDragZone({ ...input, x: 100, y: input.rowTop - 1 })).toEqual({
      kind: "outside",
    });
    expect(resolveExplorerTreeDragZone({ ...input, x: 100, y: input.rowTop + ROW_HEIGHT })).toEqual(
      {
        kind: "outside",
      },
    );
    expect(resolveExplorerTreeDragZone({ ...input, x: -1, y: input.rowTop + 24 })).toEqual({
      kind: "outside",
    });
    expect(
      resolveExplorerTreeDragZone({ ...input, x: input.listWidth, y: input.rowTop + 24 }),
    ).toEqual({
      kind: "outside",
    });
  });

  test("keeps zone keys stable for state transitions", () => {
    expect(explorerTreeDragZoneKey({ kind: "action", action: "rename" })).toBe("action:rename");
    expect(explorerTreeDragZoneKey({ kind: "inside" })).toBe("inside");
    expect(explorerTreeDragZoneKey(null)).toBe("");
  });
});

describe("explorerTreeActionCenterX", () => {
  const layout = {
    listWidth: 320,
    actionWidth: 64,
    actionGap: 8,
    actionRightMargin: 8,
  };

  test("centers on rename and delete buttons", () => {
    expect(explorerTreeActionCenterX({ action: "rename", ...layout })).toBe(208);
    expect(explorerTreeActionCenterX({ action: "delete", ...layout })).toBe(280);
  });
});

describe("explorerTreeActionTooltipPlacement", () => {
  test("keeps the tooltip above when the source row has room", () => {
    expect(
      explorerTreeActionTooltipPlacement({
        rowTop: 96,
        rowHeight: ROW_HEIGHT,
        tooltipHeight: 28,
        gap: 4,
      }),
    ).toEqual({ top: 64, side: "above" });
  });

  test("flips below when the source row is at the clipped top edge", () => {
    expect(
      explorerTreeActionTooltipPlacement({
        rowTop: 0,
        rowHeight: ROW_HEIGHT,
        tooltipHeight: 28,
        gap: 4,
      }),
    ).toEqual({ top: 52, side: "below" });
  });
});

describe("visualExplorerRowSlots", () => {
  const rows = [
    { id: "foldera001", depth: 0 },
    { id: "chapter001", depth: 1 },
    { id: "chapter002", depth: 1 },
    { id: "chapter003", depth: 0 },
    { id: "folderb002", depth: 0 },
  ];

  test("idle slots are index times row height", () => {
    const { slots, slotCount } = visualExplorerRowSlots(rows, null, ROW_HEIGHT);
    expect(slotCount).toBe(rows.length);
    expect(slots.map((slot) => slot.y)).toEqual(rows.map((_, index) => index * ROW_HEIGHT));
    expect(slots.every((slot) => slot.ghost === false)).toBe(true);
  });

  test("dragging a folder keeps original slots and marks the source subtree as ghost", () => {
    const { slots, slotCount } = visualExplorerRowSlots(rows, "foldera001", ROW_HEIGHT);
    expect(slotCount).toBe(rows.length);
    expect(slots.find((slot) => slot.id === "foldera001")).toEqual({
      id: "foldera001",
      y: 0,
      ghost: true,
    });
    expect(slots.find((slot) => slot.id === "chapter001")).toEqual({
      id: "chapter001",
      y: ROW_HEIGHT,
      ghost: true,
    });
    expect(slots.find((slot) => slot.id === "chapter002")).toEqual({
      id: "chapter002",
      y: ROW_HEIGHT * 2,
      ghost: true,
    });
    expect(slots.find((slot) => slot.id === "chapter003")).toEqual({
      id: "chapter003",
      y: ROW_HEIGHT * 3,
      ghost: false,
    });
    expect(slots.find((slot) => slot.id === "folderb002")).toEqual({
      id: "folderb002",
      y: ROW_HEIGHT * 4,
      ghost: false,
    });
  });
});
