import { describe, expect, test } from "bun:test";

import type { ToolCallItem } from "@codehz/ai";

import {
  BUILTIN_CHAPTER_WRITER_ID,
  BUILTIN_CONSISTENCY_REVIEWER_ID,
} from "#domain/settings/ai-settings";

import type { AiAgentRuntimeConfig } from "../../../settings/ai-agents-store";
import {
  formatOutputTargetKey,
  isParallelEligibleSubagentCall,
  validateParallelOutputTargets,
} from "./policy";

function toolCall(args: Record<string, unknown>, id = "call-1"): ToolCallItem {
  return {
    type: "tool_call",
    id,
    name: "run_subagent",
    argumentsText: JSON.stringify(args),
  };
}

const readOnlyAgent = {
  id: BUILTIN_CONSISTENCY_REVIEWER_ID,
  name: "一致性审查",
  subagentEligible: true,
  textOnlyMode: false,
  availableToolNames: ["read_document", "search_documents"],
} as AiAgentRuntimeConfig;

const writableAgent = {
  id: BUILTIN_CHAPTER_WRITER_ID,
  name: "章节续写",
  subagentEligible: true,
  textOnlyMode: false,
  availableToolNames: ["read_document", "write_document"],
} as AiAgentRuntimeConfig;

describe("formatOutputTargetKey", () => {
  test("combines domain and id", () => {
    expect(formatOutputTargetKey({ domain: "manuscript", id: "chapter-1" })).toBe(
      "manuscript:chapter-1",
    );
  });
});

describe("isParallelEligibleSubagentCall", () => {
  test("allows read-only subagents", () => {
    expect(
      isParallelEligibleSubagentCall(
        toolCall({ agent_id: readOnlyAgent.id, task: "审查" }),
        (id) => (id === readOnlyAgent.id ? readOnlyAgent : null),
      ),
    ).toBe(true);
  });

  test("allows pure-text subagents with output_target", () => {
    expect(
      isParallelEligibleSubagentCall(
        toolCall({
          agent_id: "builtin-brainstorm",
          task: "构思",
          output_target: { domain: "manuscript", id: "chapter-1" },
        }),
        (id) =>
          id === "builtin-brainstorm"
            ? ({
                id,
                name: "头脑风暴",
                subagentEligible: true,
                textOnlyMode: true,
                availableToolNames: [],
              } as unknown as AiAgentRuntimeConfig)
            : null,
      ),
    ).toBe(true);
  });

  test("rejects writable subagents", () => {
    expect(
      isParallelEligibleSubagentCall(
        toolCall({ agent_id: writableAgent.id, task: "续写" }),
        (id) => (id === writableAgent.id ? writableAgent : null),
      ),
    ).toBe(false);
  });

  test("rejects non-subagent tool calls", () => {
    expect(
      isParallelEligibleSubagentCall(
        { type: "tool_call", id: "x", name: "read_document", argumentsText: "{}" },
        () => readOnlyAgent,
      ),
    ).toBe(false);
  });
});

describe("validateParallelOutputTargets", () => {
  test("returns null when targets differ", () => {
    expect(
      validateParallelOutputTargets([
        toolCall(
          {
            agent_id: "builtin-brainstorm",
            task: "a",
            output_target: { domain: "manuscript", id: "chapter-1" },
          },
          "call-1",
        ),
        toolCall(
          {
            agent_id: "builtin-brainstorm",
            task: "b",
            output_target: { domain: "manuscript", id: "chapter-2" },
          },
          "call-2",
        ),
      ]),
    ).toBeNull();
  });

  test("returns null when only one call has output_target", () => {
    expect(
      validateParallelOutputTargets([
        toolCall({ agent_id: readOnlyAgent.id, task: "审查" }, "call-1"),
        toolCall(
          {
            agent_id: "builtin-brainstorm",
            task: "构思",
            output_target: { domain: "resource", id: "file-1" },
          },
          "call-2",
        ),
      ]),
    ).toBeNull();
  });

  test("rejects duplicate output_target in one batch", () => {
    const message = validateParallelOutputTargets([
      toolCall(
        {
          agent_id: "builtin-brainstorm",
          task: "a",
          output_target: { domain: "manuscript", id: "chapter-1" },
        },
        "call-1",
      ),
      toolCall(
        {
          agent_id: "builtin-roleplay",
          task: "b",
          output_target: { domain: "manuscript", id: "chapter-1" },
        },
        "call-2",
      ),
    ]);
    expect(message).toContain("同一批次");
    expect(message).toContain("chapter-1");
  });
});
