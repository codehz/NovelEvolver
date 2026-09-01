import { describe, expect, test } from "bun:test";

import type { InputItem } from "@codehz/ai";
import type { AiChatAssistantPart } from "@novelevolver/domain/ai";

import {
  countCommittedAssistantParts,
  rebuildFromLastUserMessage,
  rebuildLastRequestInput,
} from "./request-history";

describe("rebuildLastRequestInput", () => {
  test("strips trailing assistant message after user", () => {
    const history: InputItem[] = [
      { type: "message", role: "user", content: [{ type: "text", text: "hi" }] },
      { type: "message", role: "assistant", content: [{ type: "text", text: "hello" }] },
    ];
    expect(rebuildLastRequestInput(history)).toEqual([history[0]!]);
  });

  test("keeps tool_result boundary for multi-round", () => {
    const history: InputItem[] = [
      { type: "message", role: "user", content: [{ type: "text", text: "go" }] },
      { type: "tool_call", id: "c1", name: "read", argumentsText: "{}" },
      {
        type: "tool_result",
        callId: "c1",
        toolName: "read",
        outcome: "success",
        content: [{ type: "text", text: "ok" }],
      },
      { type: "message", role: "assistant", content: [{ type: "text", text: "done" }] },
    ];
    expect(rebuildLastRequestInput(history)).toEqual(history.slice(0, 3));
  });

  test("no-op when already at request boundary", () => {
    const history: InputItem[] = [
      { type: "message", role: "user", content: [{ type: "text", text: "hi" }] },
    ];
    expect(rebuildLastRequestInput(history)).toEqual(history);
  });
});

describe("rebuildFromLastUserMessage", () => {
  test("strips trailing assistant after user", () => {
    const history: InputItem[] = [
      { type: "message", role: "user", content: [{ type: "text", text: "hi" }] },
      { type: "message", role: "assistant", content: [{ type: "text", text: "hello" }] },
    ];
    expect(rebuildFromLastUserMessage(history)).toEqual([history[0]!]);
  });

  test("drops tool rounds back to last user (unlike last-request boundary)", () => {
    const history: InputItem[] = [
      { type: "message", role: "user", content: [{ type: "text", text: "go" }] },
      { type: "tool_call", id: "c1", name: "read", argumentsText: "{}" },
      {
        type: "tool_result",
        callId: "c1",
        toolName: "read",
        outcome: "success",
        content: [{ type: "text", text: "ok" }],
      },
      { type: "message", role: "assistant", content: [{ type: "text", text: "done" }] },
    ];
    expect(rebuildFromLastUserMessage(history)).toEqual([history[0]!]);
    expect(rebuildLastRequestInput(history)).toEqual(history.slice(0, 3));
  });

  test("no-op when already ends on user", () => {
    const history: InputItem[] = [
      { type: "message", role: "user", content: [{ type: "text", text: "hi" }] },
    ];
    expect(rebuildFromLastUserMessage(history)).toEqual(history);
  });
});

describe("countCommittedAssistantParts", () => {
  test("keeps completed tool rounds only", () => {
    const parts: AiChatAssistantPart[] = [
      { id: "r1", type: "reasoning", text: "think", visibility: "summary", status: "complete" },
      { id: "m1", type: "message", text: "calling", status: "complete" },
      {
        id: "c1",
        type: "tool_call",
        name: "read",
        argumentsText: "{}",
        status: "complete",
        resultText: "ok",
        errorMessage: null,
        view: null,
      },
      { id: "m2", type: "message", text: "final", status: "complete" },
    ];
    const history: InputItem[] = [
      { type: "message", role: "user", content: [{ type: "text", text: "go" }] },
      {
        type: "tool_result",
        callId: "c1",
        toolName: "read",
        outcome: "success",
        content: [{ type: "text", text: "ok" }],
      },
    ];
    expect(countCommittedAssistantParts(parts, history)).toBe(3);
  });

  test("returns 0 when no tools resolved", () => {
    const parts: AiChatAssistantPart[] = [
      { id: "m1", type: "message", text: "partial", status: "streaming" },
    ];
    const history: InputItem[] = [
      { type: "message", role: "user", content: [{ type: "text", text: "hi" }] },
    ];
    expect(countCommittedAssistantParts(parts, history)).toBe(0);
  });
});
