import { describe, expect, test } from "bun:test";

import {
  abortedSubagentResult,
  collectArtifactsFromToolCall,
  completedSubagentResult,
  failedSubagentResult,
} from "./result";

describe("collectArtifactsFromToolCall", () => {
  test("ignores read tools for wrote flag", () => {
    const artifacts = collectArtifactsFromToolCall(
      {
        name: "read_document",
        argumentsText: JSON.stringify({ target: { domain: "manuscript", id: "ch-1" } }),
      },
      JSON.stringify({ target: { id: "ch-1" } }),
    );
    expect(artifacts.wrote).toBe(false);
    expect(artifacts.touched_node_ids).toEqual([]);
  });

  test("collects write target ids", () => {
    const artifacts = collectArtifactsFromToolCall(
      {
        name: "replace_document_text",
        argumentsText: JSON.stringify({
          target: { domain: "manuscript", id: "ch-2" },
          expected_text: "a",
          replacement_text: "b",
        }),
      },
      JSON.stringify({ target: { id: "ch-2" }, revision: 3 }),
    );
    expect(artifacts.wrote).toBe(true);
    expect(artifacts.touched_node_ids).toEqual(["ch-2"]);
  });

  test("collects create_document result id", () => {
    const artifacts = collectArtifactsFromToolCall(
      {
        name: "create_document",
        argumentsText: JSON.stringify({
          domain: "manuscript",
          parent_id: "vol-1",
          name: "新章",
          content: "正文",
        }),
      },
      JSON.stringify({ id: "ch-new", parent_id: "vol-1" }),
    );
    expect(artifacts.wrote).toBe(true);
    expect(artifacts.touched_node_ids).toContain("ch-new");
  });
});

describe("result builders", () => {
  test("completed uses report", () => {
    const result = completedSubagentResult({
      agentId: "a",
      agentName: "审查",
      report: "  没有问题  ",
      stepsDigest: "read_document → 完成",
    });
    expect(result.status).toBe("completed");
    expect(result.report).toBe("没有问题");
    expect(result.steps_digest).toBe("read_document → 完成");
    expect(result.error).toBeNull();
    expect(result.output).toBeNull();
  });

  test("completed allows empty report", () => {
    const result = completedSubagentResult({
      agentId: "a",
      agentName: "审查",
    });
    expect(result.status).toBe("completed");
    expect(result.report).toBe("");
  });

  test("failed carries error", () => {
    const result = failedSubagentResult({
      agentId: "a",
      agentName: "审查",
      error: "未知 agent",
    });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("未知 agent");
    expect(result.report).toBe("未知 agent");
  });

  test("aborted default report", () => {
    const result = abortedSubagentResult({ agentId: "a", agentName: "审查" });
    expect(result.status).toBe("aborted");
    expect(result.error).toBe("aborted");
    expect(result.report).toContain("中止");
  });
});
