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
    textOnlyMode: false,
    ...partial,
  };
}

describe("summarizeSubagentCapability", () => {
  test("returns 只读 for read-only tools", () => {
    expect(
      summarizeSubagentCapability({
        availableToolNames: ["read_document", "read_structure", "search_documents", "read_changes"],
        textOnlyMode: false,
      }),
    ).toBe("只读");
  });

  test("returns 可写 when any write tool is present", () => {
    expect(
      summarizeSubagentCapability({
        availableToolNames: ["read_document", "write_document"],
        textOnlyMode: false,
      }),
    ).toBe("可写");
    expect(
      summarizeSubagentCapability({ availableToolNames: ["create_document"], textOnlyMode: false }),
    ).toBe("可写");
    expect(
      summarizeSubagentCapability({
        availableToolNames: ["replace_document_text"],
        textOnlyMode: false,
      }),
    ).toBe("可写");
    expect(
      summarizeSubagentCapability({ availableToolNames: ["delete_node"], textOnlyMode: false }),
    ).toBe("可写");
  });

  test("returns 纯文本 when textOnlyMode is true", () => {
    expect(
      summarizeSubagentCapability({
        availableToolNames: ["write_document"],
        textOnlyMode: true,
      }),
    ).toBe("纯文本");
    expect(summarizeSubagentCapability({ availableToolNames: [], textOnlyMode: true })).toBe(
      "纯文本",
    );
  });

  test("returns 只读 for empty tool list without textOnlyMode", () => {
    expect(summarizeSubagentCapability({ availableToolNames: [], textOnlyMode: false })).toBe(
      "只读",
    );
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
      agent({
        id: "builtin-roleplay",
        name: "角色扮演",
        textOnlyMode: true,
        availableToolNames: [],
      }),
      agent({ id: "a-custom", name: "自定义甲" }),
    ]);
    expect(result.map((entry) => entry.id)).toEqual([
      "builtin-consistency-reviewer",
      "builtin-chapter-writer",
      "builtin-roleplay",
      "a-custom",
      "z-custom",
    ]);
    expect(result.find((entry) => entry.id === "builtin-roleplay")?.capability).toBe("纯文本");
  });

  test("includes description lines indented in formatted section", () => {
    const result = listSubagentCatalog([
      agent({
        id: "builtin-consistency-reviewer",
        name: "一致性审查",
        description: "第一行\n第二行",
      }),
    ]);
    const section = formatAvailableSubagentsSection(result);
    expect(section).toContain("builtin-consistency-reviewer");
    expect(section).toContain("第一行");
    expect(section).toContain("  第二行");
  });

  test("empty catalog warns not to call run_subagent", () => {
    const section = formatAvailableSubagentsSection([]);
    expect(section).toContain("不要调用 `run_subagent`");
  });
});

describe("composeSystemPromptWithSubagents", () => {
  test("skips injection when parent lacks run_subagent tool", () => {
    const base = "Base prompt";
    const entries = listSubagentCatalog([agent({ id: "a", name: "A" })]);
    expect(composeSystemPromptWithSubagents(base, entries, { hasRunSubagentTool: false })).toBe(
      base,
    );
  });

  test("appends catalog section when parent has run_subagent", () => {
    const base = "Base prompt";
    const entries = listSubagentCatalog([
      agent({ id: "builtin-roleplay", name: "角色扮演", textOnlyMode: true }),
    ]);
    const composed = composeSystemPromptWithSubagents(base, entries, {
      hasRunSubagentTool: true,
    });
    expect(composed.startsWith("Base prompt")).toBe(true);
    expect(composed).toContain("## 可用子代理");
    expect(composed).toContain("builtin-roleplay");
    expect(composed).toContain("纯文本");
  });
});
