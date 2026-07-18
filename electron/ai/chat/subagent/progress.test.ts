import { describe, expect, test } from "bun:test";

import { MAX_SUBAGENT_TOOL_ROUNDS } from "./policy";
import {
  buildSubagentProgress,
  capRecentTools,
  parseSubagentProgress,
  phaseLabel,
  RECENT_TOOLS_MAX,
  serializeSubagentProgress,
  SUBAGENT_PROGRESS_KIND,
  truncatePartialSummary,
} from "./progress";

describe("truncatePartialSummary", () => {
  test("keeps short text", () => {
    expect(truncatePartialSummary("hello")).toBe("hello");
  });

  test("keeps the tail of long text", () => {
    const long = `${"a".repeat(50)}TAIL`;
    const result = truncatePartialSummary(long, 10);
    expect(result.startsWith("…")).toBe(true);
    expect(result.endsWith("TAIL")).toBe(true);
    expect(result.length).toBe(10);
  });
});

describe("capRecentTools", () => {
  test("keeps all when under limit", () => {
    const tools = [
      { name: "a", status: "complete" as const },
      { name: "b", status: "complete" as const },
    ];
    expect(capRecentTools(tools, 6)).toEqual(tools);
  });

  test("keeps newest tools when over limit", () => {
    const tools = Array.from({ length: RECENT_TOOLS_MAX + 3 }, (_, i) => ({
      name: `t${i}`,
      status: "complete" as const,
    }));
    const capped = capRecentTools(tools);
    expect(capped).toHaveLength(RECENT_TOOLS_MAX);
    expect(capped[0]?.name).toBe(`t${3}`);
    expect(capped.at(-1)?.name).toBe(`t${RECENT_TOOLS_MAX + 2}`);
  });
});

describe("buildSubagentProgress + serialize/parse", () => {
  test("builds defaults and round-trips JSON", () => {
    const progress = buildSubagentProgress({
      agentId: "builtin-consistency-reviewer",
      agentName: "一致性审查",
      phase: "thinking",
      round: 2,
      recentTools: [
        { name: "read_document", status: "complete" },
        { name: "search_documents", status: "complete" },
      ],
      partialSummary: "检查人物设定…",
      wrote: false,
      touchedCount: 1,
    });

    expect(progress.kind).toBe(SUBAGENT_PROGRESS_KIND);
    expect(progress.max_rounds).toBe(MAX_SUBAGENT_TOOL_ROUNDS);
    expect(progress.current_tool).toBeNull();
    expect(progress.artifacts).toEqual({ wrote: false, touched_count: 1 });

    const parsed = parseSubagentProgress(serializeSubagentProgress(progress));
    expect(parsed).toEqual(progress);
  });

  test("caps recent tools during build", () => {
    const tools = Array.from({ length: 10 }, (_, i) => ({
      name: `tool-${i}`,
      status: "complete" as const,
    }));
    const progress = buildSubagentProgress({
      agentId: "a",
      agentName: "A",
      phase: "tool",
      recentTools: tools,
      currentTool: { name: "write_document", status: "running" },
    });
    expect(progress.recent_tools).toHaveLength(RECENT_TOOLS_MAX);
    expect(progress.current_tool).toEqual({ name: "write_document", status: "running" });
  });

  test("parse returns null for invalid payload", () => {
    expect(parseSubagentProgress(null)).toBeNull();
    expect(parseSubagentProgress("")).toBeNull();
    expect(parseSubagentProgress("{}")).toBeNull();
    expect(parseSubagentProgress('{"kind":"other"}')).toBeNull();
  });
});

describe("phaseLabel", () => {
  test("maps phases", () => {
    expect(phaseLabel("starting")).toBe("启动中");
    expect(phaseLabel("thinking")).toBe("思考中");
    expect(phaseLabel("tool")).toBe("调用工具");
    expect(phaseLabel("finalizing")).toBe("收尾中");
  });
});
