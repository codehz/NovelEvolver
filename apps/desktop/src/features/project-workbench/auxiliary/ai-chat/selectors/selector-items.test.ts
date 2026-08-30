import { describe, expect, test } from "bun:test";

import { agentDescriptionSelectorDetail, toAgentSelectorItems } from "./selector-items";

describe("agentDescriptionSelectorDetail", () => {
  test("returns first non-empty line only", () => {
    expect(agentDescriptionSelectorDetail("首行简介\n第二行细节\n第三行")).toBe("首行简介");
  });

  test("skips leading blank lines", () => {
    expect(agentDescriptionSelectorDetail("\n\n  实际首行  \n下一行")).toBe("实际首行");
  });

  test("strips light markdown from the first line", () => {
    expect(agentDescriptionSelectorDetail("**加粗**与`代码`及[链接](https://x.test)")).toBe(
      "加粗与代码及链接",
    );
    expect(agentDescriptionSelectorDetail("## 标题行")).toBe("标题行");
  });

  test("returns empty for blank description", () => {
    expect(agentDescriptionSelectorDetail("")).toBe("");
    expect(agentDescriptionSelectorDetail("  \n  \n")).toBe("");
  });
});

describe("toAgentSelectorItems", () => {
  test("uses first-line plain description as detail", () => {
    const items = toAgentSelectorItems(
      [
        {
          id: "a",
          name: "A",
          description: "**可写**助手\n完整能力说明",
          defaultModelId: null,
          toolCount: 3,
          builtin: true,
        },
      ],
      [],
      "a",
    );
    expect(items[0]?.detail).toBe("可写助手");
  });

  test("falls back to meta when description empty", () => {
    const items = toAgentSelectorItems(
      [
        {
          id: "a",
          name: "A",
          description: "",
          defaultModelId: null,
          toolCount: 2,
          builtin: false,
        },
      ],
      [],
      "other",
    );
    expect(items[0]?.detail).toBe("自定义 · 继承默认模型 · 2 个工具");
  });
});
