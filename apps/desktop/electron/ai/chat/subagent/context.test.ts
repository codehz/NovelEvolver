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
      outputTarget: null,
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
  test("parses output_target", () => {
    const parsed = parseRunSubagentArgs(
      toolCall({
        agent_id: "builtin-roleplay",
        task: "续写",
        output_target: { domain: "manuscript", id: "ch-new" },
      }),
    );
    expect(parsed.outputTarget).toEqual({ domain: "manuscript", id: "ch-new" });
  });

  test("includes output target instructions when configured", () => {
    const text = buildSubagentUserMessage(
      {
        agentId: "w",
        task: "续写本章",
        constraints: null,
        focus: [],
        parentSummary: null,
        outputTarget: { domain: "manuscript", id: "ch-1" },
      },
      "章节写手",
      [],
      {
        outputTarget: {
          domain: "manuscript",
          id: "ch-1",
          label: "第二章",
          displayPath: "卷一/第二章",
        },
      },
    );
    expect(text).toContain("输出目标");
    expect(text).toContain("卷一/第二章");
    expect(text).toContain("可直接落盘的纯正文");
    expect(text).not.toContain("已做改动摘要");
  });

  test("includes task and isolation notice", () => {
    const text = buildSubagentUserMessage(
      {
        agentId: "r",
        task: "检查人设一致性",
        constraints: "只读",
        focus: [{ domain: "manuscript", id: "ch-1" }],
        parentSummary: "背景一句",
        outputTarget: null,
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

  test("injects preloaded focus content when snapshots provided", () => {
    const text = buildSubagentUserMessage(
      {
        agentId: "r",
        task: "审查",
        constraints: null,
        focus: [{ domain: "manuscript", id: "ch-1" }],
        parentSummary: null,
        outputTarget: null,
      },
      "一致性审查",
      [
        {
          domain: "manuscript",
          id: "ch-1",
          kind: "chapter",
          label: "第一章",
          displayPath: "卷一/第一章",
          status: "ok",
          content: "主角走进了酒馆。",
          originalCharCount: 8,
          stats: { char_count: 8, line_count: 1, word_count: 1 },
          revision: 3,
        },
      ],
    );
    expect(text).toContain("焦点预载");
    expect(text).toContain("主角走进了酒馆。");
    expect(text).toContain("revision: 3");
    expect(text).not.toContain("manuscript id=ch-1");
  });
});
