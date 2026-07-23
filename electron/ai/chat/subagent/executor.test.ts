import { describe, expect, test } from "bun:test";

import type { ToolCallItem } from "@codehz/ai";
import { createAIClient, MockAdapter, toolResultItem } from "@codehz/ai";

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
  description: "对照设定与正文做只读一致性审查",
  defaultDescription: "对照设定与正文做只读一致性审查",
  systemPrompt: "你是审查员",
  defaultSystemPrompt: "你是审查员",
  defaultModelId: null,
  availableToolNames: ["read_document", "search_documents", "run_subagent", "ask_user"],
  builtin: true,
  userSelectable: false,
  subagentEligible: true,
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

  test("returns failed when agent is not subagent eligible", async () => {
    let backendCreated = false;
    const ineligible: AiAgentRuntimeConfig = {
      ...reviewer,
      id: "custom-writer",
      name: "仅对话助手",
      subagentEligible: false,
      userSelectable: true,
    };
    const result = await executeSubagentToolCall({
      call: toolCall({ agent_id: ineligible.id, task: "审查" }),
      depth: 0,
      signal: new AbortController().signal,
      deps: {
        resolveAgentConfig: (id) => (id === ineligible.id ? ineligible : null),
        resolveModelConfig: () => null,
        resolveWorktree: () => {
          throw new Error("no worktree");
        },
        clientLabel: "test",
        parentSelectedModelId: "mock",
        parentSelectedReasoningLevel: null,
        parentAdapterKind: "mock",
        createBackend: () => {
          backendCreated = true;
          return createMockBackend("should not run");
        },
      },
    });

    expect(backendCreated).toBe(false);
    expect(result.errorMessage).toBeNull();
    expect(result.resultText).toContain("不可用作子代理");
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

  test("strips spawn tools and completes with report", async () => {
    const phases: string[] = [];
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
      onProgress: (progress) => {
        phases.push(progress.phase);
      },
    });

    expect(result.errorMessage).toBeNull();
    const json = JSON.parse(result.resultText!) as {
      status: string;
      report: string;
      agent_name: string;
    };
    expect(json.status).toBe("completed");
    expect(json.report).toContain("未发现设定冲突");
    expect(json.agent_name).toBe("一致性审查");
    expect(result.view?.kind).toBe("subagent");
    if (result.view?.kind === "subagent") {
      expect(result.view.task).toContain("审查第三章");
      expect(result.view.phase).toBe("done");
      expect(result.view.runStatus).toBe("completed");
      expect(result.view.report).toContain("未发现设定冲突");
    }
    expect(phases[0]).toBe("starting");
    expect(phases).toContain("thinking");
    expect(phases.at(-1)).toBe("finalizing");
  });

  test("completes with empty report when no final text", async () => {
    const result = await executeSubagentToolCall({
      call: toolCall({ agent_id: reviewer.id, task: "只读扫描" }),
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
        createBackend: () => createMockBackend(""),
      },
    });

    const json = JSON.parse(result.resultText!) as { status: string; report: string };
    expect(json.status).toBe("completed");
    expect(json.report).toBe("");
  });

  test("reports tool milestones when child calls tools", async () => {
    const phases: string[] = [];
    const currentTools: Array<string | null> = [];

    const adapter = new MockAdapter({
      handler: async function* (request) {
        const hasToolResult = request.input.some((item) => item.type === "tool_result");
        if (!hasToolResult) {
          yield { type: "message", content: "先读文档" };
          yield {
            type: "tool_call",
            id: "child-read-1",
            name: "read_document",
            argumentsText: JSON.stringify({
              target: { domain: "manuscript", id: "ch-1" },
            }),
          };
          yield { type: "complete", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } };
          return;
        }
        yield { type: "message", content: "审查完成：无冲突。" };
        yield { type: "complete", usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 } };
      },
    });

    const result = await executeSubagentToolCall({
      call: toolCall({ agent_id: reviewer.id, task: "审查" }),
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
        createBackend: () => ({
          adapterKind: "mock",
          model: "mock",
          instructions: "test",
          client: createAIClient({ adapter, model: "mock" }),
          scenarioId: null,
        }),
        toolRunner: {
          execute: async (call) => ({
            toolResult: toolResultItem(call.id, call.name, "success", [
              {
                type: "json",
                json: {
                  target: {
                    domain: "manuscript",
                    id: "ch-1",
                    label: "第一章",
                    display_path: "卷一/第一章",
                  },
                  stats: { char_count: 12, line_count: 2 },
                },
              },
            ]),
            resultText: JSON.stringify({
              target: {
                domain: "manuscript",
                id: "ch-1",
                label: "第一章",
                display_path: "卷一/第一章",
              },
              stats: { char_count: 12, line_count: 2 },
            }),
            errorMessage: null,
            view: null,
          }),
        },
      },
      onProgress: (progress) => {
        phases.push(progress.phase);
        currentTools.push(progress.current_tool?.name ?? null);
      },
    });

    const json = JSON.parse(result.resultText!) as {
      status: string;
      report: string;
      steps_digest: string;
    };
    expect(json.status).toBe("completed");
    expect(json.report).toContain("审查完成");
    expect(json.steps_digest).toContain("read_document");
    expect(phases).toContain("tool");
    expect(currentTools).toContain("read_document");
    expect(phases[0]).toBe("starting");
    expect(phases.at(-1)).toBe("finalizing");
    expect(result.view?.kind).toBe("subagent");
    if (result.view?.kind === "subagent") {
      expect(result.view.steps.length).toBe(1);
      expect(result.view.steps[0]?.name).toBe("read_document");
      expect(result.view.steps[0]?.status).toBe("complete");
      expect(result.view.steps[0]?.subject).toContain("第一章");
      expect(result.view.steps[0]?.outcome).toContain("字符");
      expect(result.view.phase).toBe("done");
    }
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
