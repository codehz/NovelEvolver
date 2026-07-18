import { describe, expect, test } from "bun:test";

import type { ToolCallItem } from "@codehz/ai";
import { createAIClient, MockAdapter } from "@codehz/ai";

import type { AiAgentRuntimeConfig } from "../../../settings/ai-agents-store";
import type { AiBackendSession } from "../../backend/ai-backend-session";
import { executeSubagentToolCall } from "./executor";

function toolCall(args: unknown): ToolCallItem {
  return {
    type: "tool_call",
    id: "call-sub-1",
    name: "run_subagent",
    argumentsText: JSON.stringify(args),
  };
}

function createMockBackend(message: string): AiBackendSession {
  const adapter = new MockAdapter({
    handler: async function* () {
      yield { type: "message", content: message };
      yield {
        type: "complete",
        usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
      };
    },
  });
  return {
    adapterKind: "mock",
    model: "mock",
    instructions: "test",
    client: createAIClient({ adapter, model: "mock" }),
    scenarioId: null,
  };
}

const reviewer: AiAgentRuntimeConfig = {
  id: "builtin-consistency-reviewer",
  name: "一致性审查",
  systemPrompt: "你是审查员",
  defaultModelId: null,
  availableToolNames: ["read_document", "search_documents", "run_subagent", "ask_user"],
  builtin: true,
};

describe("executeSubagentToolCall", () => {
  test("returns failed for missing agent", async () => {
    const result = await executeSubagentToolCall({
      call: toolCall({ agent_id: "missing", task: "审查" }),
      depth: 0,
      signal: new AbortController().signal,
      deps: {
        resolveAgentConfig: () => null,
        resolveModelConfig: () => null,
        resolveWorktree: () => {
          throw new Error("no worktree");
        },
        clientLabel: "test",
        parentSelectedModelId: "mock",
        parentSelectedReasoningLevel: null,
        parentAdapterKind: "mock",
      },
    });

    expect(result.errorMessage).toBeNull();
    expect(result.resultText).toContain("不存在");
    expect(result.resultText).toContain('"status": "failed"');
  });

  test("returns aborted when signal already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await executeSubagentToolCall({
      call: toolCall({ agent_id: reviewer.id, task: "审查" }),
      depth: 0,
      signal: controller.signal,
      deps: {
        resolveAgentConfig: (id) => (id === reviewer.id ? reviewer : null),
        resolveModelConfig: () => null,
        resolveWorktree: () => {
          throw new Error("no worktree");
        },
        clientLabel: "test",
        parentSelectedModelId: "mock",
        parentSelectedReasoningLevel: null,
        parentAdapterKind: "mock",
        createBackend: () => createMockBackend("should not finish"),
      },
    });

    expect(result.resultText).toBeTruthy();
    const json = JSON.parse(result.resultText!) as { status: string };
    expect(["aborted", "failed"]).toContain(json.status);
  });

  test("strips spawn tools and completes with summary", async () => {
    const result = await executeSubagentToolCall({
      call: toolCall({
        agent_id: reviewer.id,
        task: "审查第三章人设",
        focus: [{ domain: "manuscript", id: "ch-3" }],
      }),
      depth: 0,
      signal: new AbortController().signal,
      deps: {
        resolveAgentConfig: (id) => (id === reviewer.id ? reviewer : null),
        resolveModelConfig: () => null,
        resolveWorktree: () => {
          throw new Error("no worktree");
        },
        clientLabel: "test",
        parentSelectedModelId: "mock",
        parentSelectedReasoningLevel: null,
        parentAdapterKind: "mock",
        createBackend: () => createMockBackend("未发现设定冲突。"),
      },
    });

    expect(result.errorMessage).toBeNull();
    const json = JSON.parse(result.resultText!) as {
      status: string;
      summary: string;
      agent_name: string;
    };
    expect(json.status).toBe("completed");
    expect(json.summary).toContain("未发现设定冲突");
    expect(json.agent_name).toBe("一致性审查");
  });

  test("rejects nested depth", async () => {
    const result = await executeSubagentToolCall({
      call: toolCall({ agent_id: reviewer.id, task: "x" }),
      depth: 1,
      signal: new AbortController().signal,
      deps: {
        resolveAgentConfig: () => reviewer,
        resolveModelConfig: () => null,
        resolveWorktree: () => {
          throw new Error("no worktree");
        },
        clientLabel: "test",
        parentSelectedModelId: "mock",
        parentSelectedReasoningLevel: null,
        parentAdapterKind: "mock",
      },
    });
    const json = JSON.parse(result.resultText!) as { status: string; error: string };
    expect(json.status).toBe("failed");
    expect(json.error).toContain("嵌套深度");
  });
});
