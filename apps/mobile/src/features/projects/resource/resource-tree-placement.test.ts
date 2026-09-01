// @ts-expect-error Bun test types are intentionally not part of the React Native app tsconfig.
import { describe, expect, test } from "bun:test";

import type { ResourceTreeSnapshot } from "@novelevolver/domain/worktree";

import { flattenVisibleResourceRows } from "./resource-tree-flatten";
import { resolveResourceDrop } from "./resource-tree-placement";

const ROW_HEIGHT = 48;

function sampleTree(): ResourceTreeSnapshot {
  return {
    rootId: "root",
    nodes: {
      root: {
        id: "root",
        type: "folder",
        name: "",
        parentId: null,
        childIds: ["foldera001", "file000003", "folderb002"],
      },
      foldera001: {
        id: "foldera001",
        type: "folder",
        name: "设定",
        parentId: "root",
        childIds: ["file000001", "file000002"],
      },
      file000001: {
        id: "file000001",
        type: "file",
        name: "角色.md",
        parentId: "foldera001",
        childIds: [],
      },
      file000002: {
        id: "file000002",
        type: "file",
        name: "世界观.md",
        parentId: "foldera001",
        childIds: [],
      },
      file000003: {
        id: "file000003",
        type: "file",
        name: "笔记.md",
        parentId: "root",
        childIds: [],
      },
      folderb002: {
        id: "folderb002",
        type: "folder",
        name: "大纲",
        parentId: "root",
        childIds: [],
      },
    },
  };
}

function dropAt(
  tree: ResourceTreeSnapshot,
  sourceId: string,
  rowIndex: number,
  zone: "before" | "inside" | "after",
) {
  const rows = flattenVisibleResourceRows(tree);
  const offset =
    zone === "before" ? ROW_HEIGHT * 0.1 : zone === "after" ? ROW_HEIGHT * 0.9 : ROW_HEIGHT * 0.5;
  return resolveResourceDrop({
    tree,
    rows,
    sourceId,
    pointerContentY: rowIndex * ROW_HEIGHT + offset,
    rowHeight: ROW_HEIGHT,
  });
}

describe("resolveResourceDrop", () => {
  test("dropping a file onto another folder moves into that folder", () => {
    const tree = sampleTree();
    const drop = dropAt(tree, "file000003", 0, "inside");
    expect(drop).toMatchObject({
      commit: true,
      target: { kind: "into", parentId: "foldera001" },
    });
  });

  test("same-parent drop is a no-op", () => {
    const tree = sampleTree();
    const drop = dropAt(tree, "file000001", 2, "inside");
    expect(drop).toBeNull();
  });

  test("cannot drop a folder into its descendant", () => {
    const tree = sampleTree();
    const drop = dropAt(tree, "foldera001", 1, "inside");
    expect(drop).toBeNull();
  });

  test("dropping onto a file in another folder targets that file's parent", () => {
    const tree = sampleTree();
    const drop = dropAt(tree, "file000003", 1, "inside");
    expect(drop).toMatchObject({
      commit: true,
      target: { kind: "into", parentId: "foldera001" },
    });
  });

  test("dropping below the list into root is a no-op for a root child", () => {
    const tree = sampleTree();
    const rows = flattenVisibleResourceRows(tree);
    const drop = resolveResourceDrop({
      tree,
      rows,
      sourceId: "file000003",
      pointerContentY: rows.length * ROW_HEIGHT + 8,
      rowHeight: ROW_HEIGHT,
    });
    expect(drop).toBeNull();
  });
});
