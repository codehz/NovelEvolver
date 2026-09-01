import { describe, expect, test } from "bun:test";

import type { AiChatToolCall } from "@novelevolver/domain/ai";

import {
  contentWriteBodyFromArgs,
  contentWriteSubjectFromArgs,
  generationStats,
  isContentWriteToolName,
} from "./presenter-format";
import { parseObject } from "./presenter-parse";
import { presentToolCall } from "./render-tool-view";

function toolCall(
  partial: Pick<AiChatToolCall, "name" | "argumentsText" | "status"> &
    Partial<Pick<AiChatToolCall, "view" | "resultText" | "errorMessage">>,
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

describe("isContentWriteToolName", () => {
  test("covers create/write/replace only", () => {
    expect(isContentWriteToolName("create_document")).toBe(true);
    expect(isContentWriteToolName("write_document")).toBe(true);
    expect(isContentWriteToolName("replace_document_text")).toBe(true);
    expect(isContentWriteToolName("create_folder")).toBe(false);
    expect(isContentWriteToolName("read_document")).toBe(false);
  });
});

describe("content write progressive args", () => {
  test("extracts body fields by tool name", () => {
    expect(contentWriteBodyFromArgs("create_document", { content: "你好" })).toBe("你好");
    expect(contentWriteBodyFromArgs("write_document", { new_content: "全文" })).toBe("全文");
    expect(
      contentWriteBodyFromArgs("replace_document_text", {
        expected_text: "旧",
        replacement_text: "新",
      }),
    ).toBe("新");
    expect(contentWriteBodyFromArgs("create_document", { name: "章" })).toBeNull();
    expect(contentWriteBodyFromArgs("create_document", null)).toBeNull();
  });

  test("subject never surfaces bare target ids", () => {
    expect(
      contentWriteSubjectFromArgs("create_document", {
        domain: "manuscript",
        name: "第一章",
      }),
    ).toBe("手稿 · 第一章");
    expect(
      contentWriteSubjectFromArgs("write_document", {
        target: { domain: "resource", id: "uuid-should-not-show" },
      }),
    ).toBe("资源库");
    expect(contentWriteSubjectFromArgs("write_document", { target: { id: "only-id" } })).toBeNull();
  });

  test("partial-json can surface growing content", () => {
    const partial = parseObject('{"domain":"manuscript","name":"章","content":"一次');
    expect(contentWriteBodyFromArgs("create_document", partial)).toBe("一次");
    expect(contentWriteSubjectFromArgs("create_document", partial)).toBe("手稿 · 章");
  });
});

describe("generationStats", () => {
  test("pending shows live char count; missing body waits", () => {
    expect(generationStats(null, "pending")).toBe("等待正文");
    expect(generationStats("abc", "pending")).toBe("正在生成 · 3 字符");
    expect(generationStats("a\nb", "running")).toBe("3 字符 · 2 行");
  });
});

describe("presentToolCall progressive content write", () => {
  test("pending create_document shows live indicator instead of 已执行/准备中", () => {
    const presentation = presentToolCall(
      toolCall({
        name: "create_document",
        status: "pending",
        argumentsText: '{"domain":"manuscript","name":"序章","content":"开场',
      }),
    );
    expect(presentation.label).toBe("创建文档");
    expect(presentation.subject).toBe("手稿 · 序章");
    expect(presentation.indicator).toBe("正在生成 · 2 字符");
    expect(presentation.detail).toBeNull();
  });

  test("waits for body when only metadata has streamed", () => {
    const presentation = presentToolCall(
      toolCall({
        name: "create_document",
        status: "pending",
        argumentsText: '{"domain":"manuscript","name":"序章"',
      }),
    );
    expect(presentation.subject).toBe("手稿 · 序章");
    expect(presentation.indicator).toBe("等待正文");
  });

  test("completed view still wins over progressive path", () => {
    const presentation = presentToolCall(
      toolCall({
        name: "create_document",
        status: "complete",
        argumentsText: JSON.stringify({
          domain: "manuscript",
          name: "序章",
          content: "全文",
        }),
        view: {
          kind: "write",
          domainLabel: "手稿",
          documentName: "序章",
          mode: "create",
          previousScale: null,
          nextScale: "2 字符 · 1 行",
          delta: null,
          previews: null,
        },
      }),
    );
    expect(presentation.subject).toBe("手稿 · 序章");
    expect(presentation.indicator).toBe("2 字符 · 1 行");
  });

  test("generic fallback no longer claims 已执行 while pending", () => {
    const presentation = presentToolCall(
      toolCall({
        name: "read_structure",
        status: "pending",
        argumentsText: "{}",
      }),
    );
    expect(presentation.subject).toBe("…");
  });
});
