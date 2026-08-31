import { describe, expect, test } from "bun:test";

import { validateOutline } from "./manuscript";

const root = {
  id: "root",
  type: "folder" as const,
  title: "手稿",
  children: ["chap000001"],
};

const validOutline = {
  version: 1 as const,
  rootId: "root" as const,
  nodes: {
    root,
    chap000001: { id: "chap000001", type: "chapter" as const, title: "第一章" },
  },
};

describe("validateOutline", () => {
  test("normalizes a valid outline into independent node data", () => {
    const result = validateOutline(validOutline);
    expect(result).toEqual(validOutline);
    expect(result.nodes.root).not.toBe(root);
    expect(result.nodes.root).not.toBe(validOutline.nodes.root);
  });

  test("rejects multiple parents, cycles, and unreachable nodes", () => {
    expect(() =>
      validateOutline({
        ...validOutline,
        nodes: {
          ...validOutline.nodes,
          folder0001: { id: "folder0001", type: "folder" as const, title: "目录", children: [] },
        },
      }),
    ).toThrow("unreachable");

    expect(() =>
      validateOutline({
        ...validOutline,
        nodes: {
          root: { ...root, children: ["folder0001"] },
          folder0001: {
            id: "folder0001",
            type: "folder" as const,
            title: "目录",
            children: ["folder0002"],
          },
          folder0002: {
            id: "folder0002",
            type: "folder" as const,
            title: "子目录",
            children: ["folder0001"],
          },
        },
      }),
    ).toThrow("multiple parents");

    expect(() =>
      validateOutline({
        ...validOutline,
        nodes: {
          root: { ...root, children: ["folder0001", "chap000001"] },
          folder0001: {
            id: "folder0001",
            type: "folder" as const,
            title: "目录",
            children: ["chap000001"],
          },
          chap000001: { id: "chap000001", type: "chapter" as const, title: "第一章" },
        },
      }),
    ).toThrow("multiple parents");
  });

  test("rejects unsafe node IDs and chapter children", () => {
    expect(() =>
      validateOutline({
        ...validOutline,
        nodes: { root, bad: { id: "bad", type: "chapter" as const, title: "章节" } },
      }),
    ).toThrow("Invalid manuscript node id");
    expect(() =>
      validateOutline({
        ...validOutline,
        nodes: {
          root,
          chap000001: { id: "chap000001", type: "chapter" as const, title: "章节", children: [] },
        },
      }),
    ).toThrow("leaf");
  });
});
