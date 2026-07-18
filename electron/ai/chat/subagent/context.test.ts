import { describe, expect, test } from "bun:test";

import type { ToolCallItem } from "@codehz/ai";

import { buildSubagentUserMessage, parseRunSubagentArgs } from "./context";
import { MAX_PARENT_SUMMARY_CHARS } from "./policy";

function toolCall(args: unknown): ToolCallItem {
  return {
    type: "tool_call",
    id: "call-1",
    name: "run_subagent",
    argumentsText: JSON.stringify(args),
  };
}

describe("parseRunSubagentArgs", () => {
  test("parses required and optional fields", () => {
    const parsed = parseRunSubagentArgs(
      toolCall({
        agent_id: "builtin-consistency-reviewer",
        task: "审查第三章",
        constraints: "不要改文",
        focus: [{ domain: "manuscript", id: "ch-3" }],
        parent_summary: "用户想检查人设",
      }),
    );
    expect(parsed).toEqual({
      agentId: "builtin-consistency-reviewer",
      task: "审查第三章",
      constraints: "不要改文",
      focus: [{ domain: "manuscript", id: "ch-3" }],
      parentSummary: "用户想检查人设",
    });
  });

  test("truncates parent_summary", () => {
    const parsed = parseRunSubagentArgs(
      toolCall({
        agent_id: "a",
        task: "t",
        parent_summary: "x".repeat(MAX_PARENT_SUMMARY_CHARS + 5),
      }),
    );
    expect(parsed.parentSummary?.endsWith("…")).toBe(true);
  });

  test("rejects empty task", () => {
    expect(() =>
      parseRunSubagentArgs(
        toolCall({
          agent_id: "a",
          task: "  ",
        }),
      ),
    ).toThrow(/task/);
  });

  test("rejects invalid focus domain", () => {
    expect(() =>
      parseRunSubagentArgs(
        toolCall({
          agent_id: "a",
          task: "t",
          focus: [{ domain: "other", id: "x" }],
        }),
      ),
    ).toThrow(/domain/);
  });
});

describe("buildSubagentUserMessage", () => {
  test("includes task and isolation notice", () => {
    const text = buildSubagentUserMessage(
      {
        agentId: "r",
        task: "检查人设一致性",
        constraints: "只读",
        focus: [{ domain: "manuscript", id: "ch-1" }],
        parentSummary: "背景一句",
      },
      "一致性审查",
    );
    expect(text).toContain("一致性审查");
    expect(text).toContain("检查人设一致性");
    expect(text).toContain("只读");
    expect(text).toContain("manuscript id=ch-1");
    expect(text).toContain("背景一句");
    expect(text).toContain("不要假设父对话历史");
  });
});
