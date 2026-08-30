import { describe, expect, test } from "bun:test";

import { stripMarkdownPreview } from "./strip-markdown-preview";

describe("stripMarkdownPreview", () => {
  test("strips bold, lists, and links into one line", () => {
    const source = [
      "**已完成独立委派任务。**",
      "",
      "**发现与结论**：",
      "- 已依据[大纲](https://example.com)匹配第15章概要",
      "- 未发现设定冲突",
    ].join("\n");

    expect(stripMarkdownPreview(source)).toBe(
      "已完成独立委派任务。 发现与结论： 已依据大纲匹配第15章概要 未发现设定冲突",
    );
  });

  test("strips inline code and heading markers", () => {
    expect(stripMarkdownPreview("## 结论：用 `revision` 写回")).toBe("结论：用 revision 写回");
  });

  test("keeps plain text unchanged aside from whitespace", () => {
    expect(stripMarkdownPreview("  只读审查完成  ")).toBe("只读审查完成");
  });

  test("falls back to first line when strip empties content", () => {
    expect(stripMarkdownPreview("**")).toBe("**");
  });
});
