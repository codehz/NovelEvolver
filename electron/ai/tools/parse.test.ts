import { describe, expect, test } from "bun:test";

import { AIRecoverableError } from "@codehz/ai";

import { findRecoverableToolCallError, parseToolArgs } from "./parse";

describe("tool argument parsing", () => {
  test("marks malformed JSON as recoverable", () => {
    const call = {
      type: "tool_call" as const,
      id: "call-1",
      name: "read_document",
      argumentsText: '{"target":',
    };

    expect(() => parseToolArgs(call)).toThrow(AIRecoverableError);

    const recoverable = findRecoverableToolCallError([call]);
    expect(recoverable?.call).toBe(call);
    expect(recoverable?.error.code).toBe("TOOL_CALL_ARGUMENTS_INVALID");
  });

  test("keeps valid non-object JSON as a normal tool error", () => {
    const call = {
      type: "tool_call" as const,
      id: "call-1",
      name: "read_document",
      argumentsText: "[]",
    };

    expect(() => parseToolArgs(call)).toThrow("工具参数必须是 JSON 对象。");
    expect(findRecoverableToolCallError([call])).toBeNull();
  });
});
