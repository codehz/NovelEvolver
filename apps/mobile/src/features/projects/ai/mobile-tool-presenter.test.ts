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

function streamingCall(
  partial: Pick<AiChatToolCall, "name" | "argumentsText" | "status">,
): AiChatToolCall {
  return {
    id: "call-1",
    type: "tool_call",
    resultText: null,
    errorMessage: null,
    view: null,
    ...partial,
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

  test("pending create_document parses partial json instead of dumping args", () => {
    const presentation = presentMobileToolCall(
      streamingCall({
        name: "create_document",
        status: "pending",
        argumentsText: '{"domain":"manuscript","name":"序章","content":"开场',
      }),
    );
    expect(presentation.label).toBe("创建文档");
    expect(presentation.subject).toBe("手稿 · 序章");
    expect(presentation.indicator).toBe("正在生成 · 2 字符");
    expect(presentation.detail).toEqual([]);
    expect(presentation.subject).not.toContain("{");
    expect(presentation.detail.join("")).not.toContain("content");
  });

  test("waits for body when only metadata has streamed", () => {
    const presentation = presentMobileToolCall(
      streamingCall({
        name: "create_document",
        status: "pending",
        argumentsText: '{"domain":"manuscript","name":"序章"',
      }),
    );
    expect(presentation.subject).toBe("手稿 · 序章");
    expect(presentation.indicator).toBe("等待正文");
    expect(presentation.detail).toEqual([]);
  });

  test("generic fallback does not surface raw arguments", () => {
    const presentation = presentMobileToolCall(
      streamingCall({
        name: "read_structure",
        status: "pending",
        argumentsText: '{"scope":"manuscript"',
      }),
    );
    expect(presentation.label).toBe("查看结构");
    expect(presentation.subject).toBe("…");
    expect(presentation.indicator).toBe("准备中");
    expect(presentation.detail).toEqual([]);
  });

  test("live work summary uses the Chinese action label", () => {
    expect(
      describeMobileWork([
        streamingCall({
          name: "create_document",
          status: "pending",
          argumentsText: '{"domain":"manuscript","name":"序章","content":"开场',
        }),
      ]),
    ).toBe("创建文档");
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
