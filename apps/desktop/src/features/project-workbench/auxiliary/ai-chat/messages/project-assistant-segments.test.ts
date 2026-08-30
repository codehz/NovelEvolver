import { describe, expect, test } from "bun:test";

import type {
  AiChatAssistantPart,
  AiChatMessagePart,
  AiChatReasoningPart,
  AiChatToolCall,
} from "#shared/rpc/ai/index";

import { describeWorkSummary } from "../ui/ai-chat-helpers";
import {
  countWorkSteps,
  isElevatedToolCall,
  isWorkSegmentLive,
  projectAssistantSegments,
  shouldKeepWorkExpanded,
} from "./project-assistant-segments";

function prose(id: string, text = "hello"): AiChatMessagePart {
  return { id, type: "message", text, status: "complete" };
}

function reasoning(
  id: string,
  status: AiChatReasoningPart["status"] = "complete",
): AiChatReasoningPart {
  return {
    id,
    type: "reasoning",
    text: "think",
    visibility: "summary",
    status,
  };
}

function tool(
  id: string,
  name: string,
  status: AiChatToolCall["status"] = "complete",
): AiChatToolCall {
  return {
    id,
    type: "tool_call",
    name,
    argumentsText: "{}",
    status,
    resultText: null,
    errorMessage: null,
    view: null,
  };
}

describe("projectAssistantSegments", () => {
  test("empty parts → empty segments", () => {
    expect(projectAssistantSegments([])).toEqual([]);
  });

  test("prose only", () => {
    const segments = projectAssistantSegments([prose("m1")]);
    expect(segments).toEqual([
      {
        kind: "prose",
        id: "m1",
        part: prose("m1"),
      },
    ]);
  });

  test("continuous reasoning + tools → single work", () => {
    const parts: AiChatAssistantPart[] = [
      reasoning("r1"),
      tool("t1", "read_document"),
      tool("t2", "search_documents"),
    ];
    const segments = projectAssistantSegments(parts);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      kind: "work",
      id: "work:r1",
    });
    if (segments[0]?.kind === "work") {
      expect(segments[0].steps.map((s) => s.id)).toEqual(["r1", "t1", "t2"]);
      expect(countWorkSteps(segments[0].steps)).toBe(3);
    }
  });

  test("prose breaks work into two segments", () => {
    const parts: AiChatAssistantPart[] = [
      reasoning("r1"),
      tool("t1", "read_document"),
      prose("m1"),
      tool("t2", "search_documents"),
    ];
    const segments = projectAssistantSegments(parts);
    expect(segments.map((s) => s.kind)).toEqual(["work", "prose", "work"]);
    expect(segments[0]).toMatchObject({ kind: "work", id: "work:r1" });
    expect(segments[1]).toMatchObject({ kind: "prose", id: "m1" });
    expect(segments[2]).toMatchObject({ kind: "work", id: "work:t2" });
    if (segments[0]?.kind === "work") {
      expect(segments[0].steps.map((s) => s.id)).toEqual(["r1", "t1"]);
    }
    if (segments[2]?.kind === "work") {
      expect(segments[2].steps.map((s) => s.id)).toEqual(["t2"]);
    }
  });

  test("run_subagent and ask_user are elevated and never join work", () => {
    const parts: AiChatAssistantPart[] = [
      reasoning("r1"),
      tool("t1", "read_document"),
      tool("s1", "run_subagent"),
      tool("a1", "ask_user"),
      tool("t2", "search_documents"),
      prose("m1"),
    ];
    const segments = projectAssistantSegments(parts);
    expect(segments.map((s) => s.kind)).toEqual(["work", "subagent", "ask_user", "work", "prose"]);
    expect(segments[0]).toMatchObject({ kind: "work", id: "work:r1" });
    expect(segments[1]).toMatchObject({ kind: "subagent", id: "s1" });
    expect(segments[2]).toMatchObject({ kind: "ask_user", id: "a1" });
    expect(segments[3]).toMatchObject({ kind: "work", id: "work:t2" });
  });

  test("elevated tools alone do not create empty work", () => {
    const segments = projectAssistantSegments([tool("s1", "run_subagent"), tool("a1", "ask_user")]);
    expect(segments.map((s) => s.kind)).toEqual(["subagent", "ask_user"]);
  });

  test("isElevatedToolCall", () => {
    expect(isElevatedToolCall(tool("s1", "run_subagent"))).toBe(true);
    expect(isElevatedToolCall(tool("a1", "ask_user"))).toBe(true);
    expect(isElevatedToolCall(tool("t1", "read_document"))).toBe(false);
    expect(isElevatedToolCall(reasoning("r1"))).toBe(false);
    expect(isElevatedToolCall(prose("m1"))).toBe(false);
  });

  test("isWorkSegmentLive detects streaming/running/pending/awaiting_user", () => {
    expect(isWorkSegmentLive([reasoning("r1", "complete"), tool("t1", "read_document")])).toBe(
      false,
    );
    expect(isWorkSegmentLive([reasoning("r1", "streaming")])).toBe(true);
    expect(isWorkSegmentLive([tool("t1", "read_document", "running")])).toBe(true);
    expect(isWorkSegmentLive([tool("t1", "read_document", "pending")])).toBe(true);
    expect(isWorkSegmentLive([tool("t1", "ask_user", "awaiting_user")])).toBe(true);
  });

  test("shouldKeepWorkExpanded holds open during trailing tool gaps", () => {
    expect(
      shouldKeepWorkExpanded({
        isStepsLive: true,
        messageStreaming: false,
        isLastSegment: false,
      }),
    ).toBe(true);
    expect(
      shouldKeepWorkExpanded({
        isStepsLive: false,
        messageStreaming: true,
        isLastSegment: true,
      }),
    ).toBe(true);
    expect(
      shouldKeepWorkExpanded({
        isStepsLive: false,
        messageStreaming: true,
        isLastSegment: false,
      }),
    ).toBe(false);
    expect(
      shouldKeepWorkExpanded({
        isStepsLive: false,
        messageStreaming: false,
        isLastSegment: true,
      }),
    ).toBe(false);
    expect(
      shouldKeepWorkExpanded({
        isStepsLive: true,
        messageStreaming: true,
        isLastSegment: false,
      }),
    ).toBe(true);
  });
});

describe("describeWorkSummary", () => {
  test("done mixed steps use unified step count", () => {
    expect(
      describeWorkSummary([
        reasoning("r1"),
        tool("t1", "read_document"),
        tool("t2", "search_documents"),
      ]),
    ).toBe("已完成 3 个步骤");
  });

  test("done reasoning-only uses unified step count", () => {
    expect(describeWorkSummary([reasoning("r1")])).toBe("已完成 1 个步骤");
  });

  test("done tools with errors append failure count", () => {
    expect(
      describeWorkSummary([
        reasoning("r1"),
        tool("t1", "read_document", "error"),
        tool("t2", "search_documents"),
      ]),
    ).toBe("已完成 3 个步骤 · 1 失败");
  });

  test("empty steps", () => {
    expect(describeWorkSummary([])).toBe("无步骤");
  });

  test("live streaming reasoning is status-only", () => {
    expect(describeWorkSummary([reasoning("r1", "streaming")])).toBe("进行中");
  });

  test("live running tool shows action label without step index", () => {
    expect(describeWorkSummary([reasoning("r1"), tool("t1", "read_document", "running")])).toBe(
      "读取",
    );
  });
});
