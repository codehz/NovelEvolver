import { describe, expect, test } from "bun:test";

import {
  assertSubagentDepth,
  assertSubagentEligible,
  MAX_PARENT_SUMMARY_CHARS,
  MAX_SUBAGENT_DEPTH,
  resolveSubagentModelId,
  RUN_SUBAGENT_TOOL_NAME,
  stripSubagentTools,
  truncateParentSummary,
} from "./policy";

describe("stripSubagentTools", () => {
  test("removes run_subagent and ask_user", () => {
    expect(
      stripSubagentTools(["read_document", RUN_SUBAGENT_TOOL_NAME, "ask_user", "write_document"]),
    ).toEqual(["read_document", "write_document"]);
  });

  test("keeps unrelated tools", () => {
    expect(stripSubagentTools(["read_structure", "search_documents"])).toEqual([
      "read_structure",
      "search_documents",
    ]);
  });
});

describe("assertSubagentDepth", () => {
  test("allows depth 0", () => {
    expect(() => assertSubagentDepth(0)).not.toThrow();
  });

  test("rejects nested depth", () => {
    expect(() => assertSubagentDepth(MAX_SUBAGENT_DEPTH)).toThrow(/嵌套深度/);
    expect(() => assertSubagentDepth(2)).toThrow(/嵌套深度/);
  });

  test("rejects invalid depth", () => {
    expect(() => assertSubagentDepth(-1)).toThrow();
    expect(() => assertSubagentDepth(0.5)).toThrow();
  });
});

describe("assertSubagentEligible", () => {
  test("allows eligible agents", () => {
    expect(() =>
      assertSubagentEligible({ name: "一致性审查", subagentEligible: true }),
    ).not.toThrow();
  });

  test("rejects ineligible agents", () => {
    expect(() => assertSubagentEligible({ name: "写作助手", subagentEligible: false })).toThrow(
      /不可用作子代理/,
    );
  });
});

describe("truncateParentSummary", () => {
  test("returns null for empty", () => {
    expect(truncateParentSummary(null)).toBeNull();
    expect(truncateParentSummary(undefined)).toBeNull();
    expect(truncateParentSummary("   ")).toBeNull();
  });

  test("keeps short text", () => {
    expect(truncateParentSummary("  hello  ")).toBe("hello");
  });

  test("truncates long text", () => {
    const long = "a".repeat(MAX_PARENT_SUMMARY_CHARS + 10);
    const result = truncateParentSummary(long);
    expect(result).not.toBeNull();
    expect(result!.endsWith("…")).toBe(true);
    expect(result!.length).toBe(MAX_PARENT_SUMMARY_CHARS + 1);
  });
});

describe("resolveSubagentModelId", () => {
  test("prefers available agent default", () => {
    expect(resolveSubagentModelId("model-a", "parent-model", (id) => id === "model-a")).toBe(
      "model-a",
    );
  });

  test("falls back to parent when default missing", () => {
    expect(resolveSubagentModelId(null, "parent-model", () => true)).toBe("parent-model");
    expect(resolveSubagentModelId("gone", "parent-model", (id) => id === "parent-model")).toBe(
      "parent-model",
    );
  });
});
