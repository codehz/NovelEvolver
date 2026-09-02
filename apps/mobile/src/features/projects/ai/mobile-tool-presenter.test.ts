// @ts-expect-error Bun test types are intentionally not part of the React Native app tsconfig.
import { describe, expect, test } from "bun:test";

import type { AiChatToolCall } from "@novelevolver/domain/ai";

import { describeMobileWork, presentMobileToolCall } from "./mobile-tool-presenter";

function tool(status: AiChatToolCall["status"] = "complete"): AiChatToolCall {
  return {
    id: "tool-1",
    type: "tool_call",
    name: "search_documents",
    argumentsText: "{}",
    status,
    resultText: null,
    errorMessage: null,
    view: {
      kind: "search",
      query: "chapter",
      isRegex: false,
      scopeLabel: "全部文档",
      hits: [{ path: "chapter.md", line: 3, snippet: "chapter" }],
      hitCount: 1,
    },
  };
}

describe("mobile tool presenter", () => {
  test("renders typed search details and completion", () => {
    expect(presentMobileToolCall(tool())).toMatchObject({
      label: "搜索",
      subject: "“chapter”",
      indicator: "完成",
      detail: ["范围：全部文档", "命中：1 处", "chapter.md:3 · chapter"],
    });
  });

  test("keeps live status visible", () => {
    expect(presentMobileToolCall(tool("running")).indicator).toBe("进行中");
  });

  test("summarizes completed work and failures", () => {
    const reasoning = {
      id: "reasoning-1",
      type: "reasoning" as const,
      text: "done",
      visibility: "summary" as const,
      status: "complete" as const,
    };
    const failed = { ...tool("error"), id: "tool-2" };
    expect(describeMobileWork([reasoning, failed])).toBe("已完成 2 个步骤 · 1 失败");
  });
});
