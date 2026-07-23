import { describe, expect, test } from "bun:test";

import {
  composeSystemPromptWithSubagents,
  formatAvailableSubagentsSection,
  listSubagentCatalog,
  summarizeSubagentCapability,
  type SubagentCatalogAgent,
} from "./prompt-visibility";

function agent(
  partial: Partial<SubagentCatalogAgent> & Pick<SubagentCatalogAgent, "id" | "name">,
): SubagentCatalogAgent {
  return {
    availableToolNames: ["read_document"],
    subagentEligible: true,
    ...partial,
  };
}

describe("summarizeSubagentCapability", () => {
  test("returns 只读 for read-only tools", () => {
    expect(
      summarizeSubagentCapability([
        "read_document",
        "read_structure",
        "search_documents",
        "read_changes",
      ]),
    ).toBe("只读");
  });

  test("returns 可写 when any write tool is present", () => {
    expect(summarizeSubagentCapability(["read_document", "write_document"])).toBe("可写");
    expect(summarizeSubagentCapability(["create_document"])).toBe("可写");
    expect(summarizeSubagentCapability(["replace_document_text"])).toBe("可写");
    expect(summarizeSubagentCapability(["delete_node"])).toBe("可写");
  });

  test("returns 只读 for empty tool list", () => {
    expect(summarizeSubagentCapability([])).toBe("只读");
  });
});

describe("listSubagentCatalog", () => {
  test("filters to subagentEligible only", () => {
    const result = listSubagentCatalog([
      agent({ id: "a", name: "A", subagentEligible: true }),
      agent({ id: "b", name: "B", subagentEligible: false }),
      agent({ id: "c", name: "C", subagentEligible: true }),
    ]);
    expect(result.map((entry) => entry.id)).toEqual(["a", "c"]);
  });

  test("excludes current session agent id", () => {
    const result = listSubagentCatalog(
      [agent({ id: "parent", name: "Parent" }), agent({ id: "child", name: "Child" })],
      { excludeAgentId: "parent" },
    );
    expect(result.map((entry) => entry.id)).toEqual(["child"]);
  });

  test("prefers builtin specialists, then sorts by name", () => {
    const result = listSubagentCatalog([
      agent({ id: "z-custom", name: "自定义乙" }),
      agent({
        id: "builtin-chapter-writer",
        name: "章节续写",
        availableToolNames: ["write_document"],
      }),
      agent({
        id: "builtin-consistency-reviewer",
        name: "一致性审查",
        availableToolNames: ["read_document"],
      }),
      agent({ id: "a-custom", name: "自定义甲" }),
    ]);
    expect(result.map((entry) => entry.id)).toEqual([
      "builtin-consistency-reviewer",
      "builtin-chapter-writer",
      "a-custom",
      "z-custom",
    ]);
  });

  test("derives capability per agent", () => {
    const result = listSubagentCatalog([
      agent({
        id: "r",
        name: "Read",
        availableToolNames: ["read_document"],
      }),
      agent({
        id: "w",
        name: "Write",
        availableToolNames: ["write_document"],
      }),
    ]);
    expect(result.find((e) => e.id === "r")?.capability).toBe("只读");
    expect(result.find((e) => e.id === "w")?.capability).toBe("可写");
  });

  test("forwards trimmed description", () => {
    const result = listSubagentCatalog([
      agent({ id: "a", name: "A", description: "  简短说明  " }),
      agent({ id: "b", name: "B" }),
    ]);
    expect(result.find((e) => e.id === "a")?.description).toBe("简短说明");
    expect(result.find((e) => e.id === "b")?.description).toBe("");
  });
});

describe("formatAvailableSubagentsSection", () => {
  test("renders empty list guidance", () => {
    const text = formatAvailableSubagentsSection([]);
    expect(text).toContain("## 可用子代理");
    expect(text).toContain("当前没有可用子代理");
    expect(text).toContain("不要调用 `run_subagent`");
  });

  test("renders id, name, and capability lines", () => {
    const text = formatAvailableSubagentsSection([
      {
        id: "builtin-consistency-reviewer",
        name: "一致性审查",
        capability: "只读",
        description: "",
      },
      { id: "custom-writer", name: "定制写手", capability: "可写", description: "" },
    ]);
    expect(text).toContain("## 可用子代理");
    expect(text).toContain("agent_id` 必须从下列列表选取");
    expect(text).toContain("`builtin-consistency-reviewer`（一致性审查，只读）");
    expect(text).toContain("`custom-writer`（定制写手，可写）");
    expect(text).not.toContain("—");
  });

  test("appends description when present", () => {
    const text = formatAvailableSubagentsSection([
      {
        id: "builtin-consistency-reviewer",
        name: "一致性审查",
        capability: "只读",
        description: "对照设定与正文做只读一致性审查",
      },
    ]);
    expect(text).toContain(
      "`builtin-consistency-reviewer`（一致性审查，只读）— 对照设定与正文做只读一致性审查",
    );
  });
});

describe("composeSystemPromptWithSubagents", () => {
  const base = "你是写作助手。\n\n## 子代理委派\n- 可用 run_subagent。";

  test("returns base unchanged when run_subagent is absent", () => {
    expect(
      composeSystemPromptWithSubagents(
        base,
        [{ id: "a", name: "A", capability: "只读", description: "" }],
        {
          hasRunSubagentTool: false,
        },
      ),
    ).toBe(base);
  });

  test("appends section when run_subagent is present", () => {
    const result = composeSystemPromptWithSubagents(
      base,
      [{ id: "a", name: "A", capability: "只读", description: "短简介" }],
      { hasRunSubagentTool: true },
    );
    expect(result.startsWith(base)).toBe(true);
    expect(result).toContain("## 可用子代理");
    expect(result).toContain("`a`（A，只读）— 短简介");
    expect(result).toMatch(/\n\n## 可用子代理/);
  });

  test("appends empty-list section when no eligible agents", () => {
    const result = composeSystemPromptWithSubagents(base, [], { hasRunSubagentTool: true });
    expect(result).toContain("当前没有可用子代理");
  });

  test("trims trailing whitespace on base before append", () => {
    const result = composeSystemPromptWithSubagents(`${base}\n\n  `, [], {
      hasRunSubagentTool: true,
    });
    expect(result).not.toMatch(/\n{3,}## 可用子代理/);
    expect(result.endsWith("不要调用 `run_subagent`。")).toBe(true);
  });
});
