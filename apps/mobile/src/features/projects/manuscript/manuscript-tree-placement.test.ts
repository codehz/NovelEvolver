// @ts-expect-error Bun test types are intentionally not part of the React Native app tsconfig.
import { describe, expect, test } from "bun:test";

import type { ManuscriptOutline } from "@novelevolver/domain/worktree";

import { flattenVisibleManuscriptRows, visualManuscriptRowSlots } from "./manuscript-tree-flatten";
import {
  manuscriptTreeDragZoneKey,
  resolveManuscriptTreeDragZone,
} from "./manuscript-tree-gesture";
import {
  resolveHoverZone,
  resolveManuscriptDrop,
  type ManuscriptHoverZone,
} from "./manuscript-tree-placement";

const ROW_HEIGHT = 48;

function sampleOutline(): ManuscriptOutline {
  return {
    version: 1,
    rootId: "root",
    nodes: {
      root: {
        id: "root",
        type: "folder",
        title: "手稿",
        children: ["foldera001", "chapter003", "folderb002"],
      },
      foldera001: {
        id: "foldera001",
        type: "folder",
        title: "第一幕",
        children: ["chapter001", "chapter002"],
      },
      chapter001: { id: "chapter001", type: "chapter", title: "开场" },
      chapter002: { id: "chapter002", type: "chapter", title: "冲突" },
      chapter003: { id: "chapter003", type: "chapter", title: "尾声" },
      folderb002: { id: "folderb002", type: "folder", title: "第二幕", children: [] },
    },
  };
}

function dropAt(
  outline: ManuscriptOutline,
  sourceId: string,
  rowIndex: number,
  zone: ManuscriptHoverZone,
  collapsedIds: Record<string, true> = {},
) {
  const rows = flattenVisibleManuscriptRows(outline, collapsedIds);
  const source = outline.nodes[sourceId];
  if (source === undefined) throw new Error(`missing source ${sourceId}`);
  const offset =
    zone === "before" ? ROW_HEIGHT * 0.1 : zone === "after" ? ROW_HEIGHT * 0.9 : ROW_HEIGHT * 0.5;
  return resolveManuscriptDrop({
    outline,
    rows,
    sourceId,
    sourceType: source.type,
    pointerContentY: rowIndex * ROW_HEIGHT + offset,
    rowHeight: ROW_HEIGHT,
  });
}

describe("resolveHoverZone", () => {
  test("splits a row into before / inside / after", () => {
    expect(resolveHoverZone(0, ROW_HEIGHT)).toBe("before");
    expect(resolveHoverZone(ROW_HEIGHT * 0.24, ROW_HEIGHT)).toBe("before");
    expect(resolveHoverZone(ROW_HEIGHT * 0.5, ROW_HEIGHT)).toBe("inside");
    expect(resolveHoverZone(ROW_HEIGHT * 0.76, ROW_HEIGHT)).toBe("after");
  });
});

describe("resolveManuscriptTreeDragZone", () => {
  const input = {
    rowTop: ROW_HEIGHT * 2,
    rowHeight: ROW_HEIGHT,
    listWidth: 320,
    actionWidth: 64,
    actionGap: 8,
    actionRightMargin: 8,
  };

  test("shows rename and delete zones at the right edge of the source row", () => {
    expect(resolveManuscriptTreeDragZone({ ...input, x: 167, y: input.rowTop + 24 })).toEqual({
      kind: "inside",
    });
    expect(resolveManuscriptTreeDragZone({ ...input, x: 200, y: input.rowTop + 24 })).toEqual({
      kind: "action",
      action: "rename",
    });
    expect(resolveManuscriptTreeDragZone({ ...input, x: 244, y: input.rowTop + 24 })).toEqual({
      kind: "inside",
    });
    expect(resolveManuscriptTreeDragZone({ ...input, x: 270, y: input.rowTop + 24 })).toEqual({
      kind: "action",
      action: "delete",
    });
    expect(resolveManuscriptTreeDragZone({ ...input, x: 315, y: input.rowTop + 24 })).toEqual({
      kind: "inside",
    });
  });

  test("treats every direction outside the source row as outside", () => {
    expect(resolveManuscriptTreeDragZone({ ...input, x: 100, y: input.rowTop - 1 })).toEqual({
      kind: "outside",
    });
    expect(
      resolveManuscriptTreeDragZone({ ...input, x: 100, y: input.rowTop + ROW_HEIGHT }),
    ).toEqual({
      kind: "outside",
    });
    expect(resolveManuscriptTreeDragZone({ ...input, x: -1, y: input.rowTop + 24 })).toEqual({
      kind: "outside",
    });
    expect(
      resolveManuscriptTreeDragZone({ ...input, x: input.listWidth, y: input.rowTop + 24 }),
    ).toEqual({
      kind: "outside",
    });
  });

  test("keeps zone keys stable for state transitions", () => {
    expect(manuscriptTreeDragZoneKey({ kind: "action", action: "rename" })).toBe("action:rename");
    expect(manuscriptTreeDragZoneKey({ kind: "inside" })).toBe("inside");
    expect(manuscriptTreeDragZoneKey(null)).toBe("");
  });
});

describe("visualManuscriptRowSlots", () => {
  test("idle slots are index times row height", () => {
    const rows = flattenVisibleManuscriptRows(sampleOutline());
    const { slots, slotCount } = visualManuscriptRowSlots(rows, null, ROW_HEIGHT);
    expect(slotCount).toBe(rows.length);
    expect(slots.map((slot) => slot.y)).toEqual(rows.map((_, index) => index * ROW_HEIGHT));
    expect(slots.every((slot) => slot.ghost === false)).toBe(true);
  });

  test("dragging a folder keeps original slots and marks the source subtree as ghost", () => {
    const rows = flattenVisibleManuscriptRows(sampleOutline());
    const { slots, slotCount } = visualManuscriptRowSlots(rows, "foldera001", ROW_HEIGHT);
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

describe("resolveManuscriptDrop", () => {
  test("reorders siblings when dropping before an earlier root item", () => {
    const outline = sampleOutline();
    const drop = dropAt(outline, "folderb002", 3, "before");
    expect(drop?.commit).toBe(true);
    expect(drop?.target).toEqual({ kind: "insert", parentId: "root", index: 1 });
  });

  test("ignores the original source slot", () => {
    const outline = sampleOutline();
    expect(dropAt(outline, "chapter003", 3, "before")).toBeNull();
  });

  test("moves a chapter into a folder via the inside zone", () => {
    const outline = sampleOutline();
    const drop = dropAt(outline, "chapter003", 4, "inside");
    expect(drop?.commit).toBe(true);
    expect(drop?.target).toEqual({ kind: "into", parentId: "folderb002" });
    expect(drop?.preview).toEqual({ kind: "highlight", startIndex: 4, endIndex: 4 });
  });

  test("highlights the visible subtree when dropping into an expanded folder", () => {
    const outline = sampleOutline();
    const drop = dropAt(outline, "chapter003", 0, "inside");
    expect(drop?.commit).toBe(true);
    expect(drop?.target).toEqual({ kind: "into", parentId: "foldera001" });
    expect(drop?.preview).toEqual({ kind: "highlight", startIndex: 0, endIndex: 2 });
  });

  test("moves a nested chapter out to root by dropping after a root sibling", () => {
    const outline = sampleOutline();
    const drop = dropAt(outline, "chapter001", 3, "after");
    expect(drop?.commit).toBe(true);
    expect(drop?.target).toEqual({ kind: "insert", parentId: "root", index: 2 });
  });

  test("inserts as the first child when dropping after an expanded folder with children", () => {
    const outline = sampleOutline();
    const drop = dropAt(outline, "chapter003", 0, "after");
    expect(drop?.commit).toBe(true);
    expect(drop?.target).toEqual({ kind: "insert", parentId: "foldera001", index: 0 });
  });

  test("inserts as a sibling after a collapsed folder", () => {
    const outline = sampleOutline();
    const drop = dropAt(outline, "folderb002", 0, "after", { foldera001: true });
    expect(drop?.commit).toBe(true);
    expect(drop?.target).toEqual({ kind: "insert", parentId: "root", index: 1 });
  });

  test("does not target a dragged folder or its descendants", () => {
    const outline = sampleOutline();
    expect(dropAt(outline, "foldera001", 4, "inside")?.target).toEqual({
      kind: "into",
      parentId: "folderb002",
    });
    expect(dropAt(outline, "foldera001", 1, "inside")).toBeNull();
    expect(dropAt(outline, "foldera001", 0, "before")).toBeNull();
  });

  test("folds chapter inside-zone to before or after by pointer Y", () => {
    const outline = sampleOutline();
    const rows = flattenVisibleManuscriptRows(outline);
    const before = resolveManuscriptDrop({
      outline,
      rows,
      sourceId: "folderb002",
      sourceType: "folder",
      pointerContentY: 3 * ROW_HEIGHT + ROW_HEIGHT * 0.4,
      rowHeight: ROW_HEIGHT,
    });
    const after = resolveManuscriptDrop({
      outline,
      rows,
      sourceId: "foldera001",
      sourceType: "folder",
      pointerContentY: 3 * ROW_HEIGHT + ROW_HEIGHT * 0.6,
      rowHeight: ROW_HEIGHT,
    });
    expect(before?.target).toEqual({ kind: "insert", parentId: "root", index: 1 });
    expect(after?.target).toEqual({ kind: "insert", parentId: "root", index: 2 });
  });
});
