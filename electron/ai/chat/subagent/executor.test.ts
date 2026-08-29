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
  textOnlyMode: false,
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

  test("retries only the malformed tool round", async () => {
    let requestCount = 0;
    const executedCalls: string[] = [];
    const adapter = new MockAdapter({
      handler: async function* (request) {
        requestCount += 1;
        if (requestCount === 1) {
          yield {
            type: "tool_call",
            id: "malformed-read",
            name: "read_document",
            argumentsText: '{"target":',
          };
          yield { type: "complete" };
          return;
        }
        if (requestCount === 2) {
          expect(request.instructions).toContain("参数不是合法的 JSON 对象");
          expect(request.input.some((item) => item.type === "tool_call")).toBe(false);
          yield {
            type: "tool_call",
            id: "recovered-read",
            name: "read_document",
            argumentsText: JSON.stringify({
              target: { domain: "manuscript", id: "ch-1" },
            }),
          };
          yield { type: "complete" };
          return;
        }

        expect(request.instructions).toBe("test");
        expect(
          request.input.some((item) => item.type === "tool_call" && item.id === "malformed-read"),
        ).toBe(false);
        expect(
          request.input.some((item) => item.type === "tool_call" && item.id === "recovered-read"),
        ).toBe(true);
        yield { type: "message", content: "恢复完成。" };
        yield { type: "complete" };
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
          execute: async (call) => {
            executedCalls.push(call.id);
            return {
              toolResult: toolResultItem(call.id, call.name, "success", [
                { type: "json", json: { ok: true } },
              ]),
              resultText: '{"ok":true}',
              errorMessage: null,
              view: null,
            };
          },
        },
      },
    });

    expect(requestCount).toBe(3);
    expect(executedCalls).toEqual(["recovered-read"]);
    expect(result.resultText).toContain("恢复完成");
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

  test("completes text-only subagent without tools", async () => {
    const roleplay: AiAgentRuntimeConfig = {
      id: "builtin-roleplay",
      name: "角色扮演",
      description: "纯文本创意人格",
      defaultDescription: "纯文本创意人格",
      systemPrompt: "你是创意人格",
      defaultSystemPrompt: "你是创意人格",
      defaultModelId: null,
      availableToolNames: [],
      builtin: true,
      userSelectable: false,
      subagentEligible: true,
      textOnlyMode: true,
    };

    const result = await executeSubagentToolCall({
      call: toolCall({ agent_id: roleplay.id, task: "以反派口吻改写这段对话" }),
      depth: 0,
      signal: new AbortController().signal,
      deps: {
        resolveAgentConfig: (id) => (id === roleplay.id ? roleplay : null),
        resolveModelConfig: () => null,
        resolveWorktree: () => {
          throw new Error("no worktree");
        },
        clientLabel: "test",
        parentSelectedModelId: "mock",
        parentSelectedReasoningLevel: null,
        parentAdapterKind: "mock",
        createBackend: () => createMockBackend("（冷笑）你以为逃得掉吗？"),
      },
    });

    expect(result.errorMessage).toBeNull();
    const json = JSON.parse(result.resultText!) as { status: string; report: string };
    expect(json.status).toBe("completed");
    expect(json.report).toContain("冷笑");
  });

  test("fails when agent needs tools but model does not support tools", async () => {
    let backendCreated = false;
    const result = await executeSubagentToolCall({
      call: toolCall({ agent_id: reviewer.id, task: "审查" }),
      depth: 0,
      signal: new AbortController().signal,
      deps: {
        resolveAgentConfig: (id) => (id === reviewer.id ? reviewer : null),
        resolveModelConfig: () => ({
          id: "local-chat",
          name: "Local Chat",
          kind: "ollama",
          model: "llama3",
          baseUrl: "",
          apiKey: null,
          maxOutputTokens: 4096,
          contextLength: null,
          availableReasoningLevels: [],
          defaultReasoningLevel: null,
          temperature: null,
          cache: {},
          headers: {},
          extraBody: {},
          supportsTools: false,
        }),
        resolveWorktree: () => {
          throw new Error("no worktree");
        },
        clientLabel: "test",
        parentSelectedModelId: "local-chat",
        parentSelectedReasoningLevel: null,
        parentAdapterKind: "ollama",
        createBackend: () => {
          backendCreated = true;
          return createMockBackend("should not run");
        },
      },
    });

    expect(backendCreated).toBe(false);
    const json = JSON.parse(result.resultText!) as { status: string; error: string };
    expect(json.status).toBe("failed");
    expect(json.error).toContain("不支持工具调用");
  });

  test("writes output_target and redacts report for parent on success", async () => {
    let storedContent = "占位";
    let revision = 1;
    const roleplay: AiAgentRuntimeConfig = {
      id: "builtin-roleplay",
      name: "角色扮演",
      description: "纯文本创意人格",
      defaultDescription: "纯文本创意人格",
      systemPrompt: "你是创意人格",
      defaultSystemPrompt: "你是创意人格",
      defaultModelId: null,
      availableToolNames: [],
      builtin: true,
      userSelectable: false,
      subagentEligible: true,
      textOnlyMode: true,
    };

    const result = await executeSubagentToolCall({
      call: toolCall({
        agent_id: roleplay.id,
        task: "写出本章正文",
        output_target: { domain: "manuscript", id: "ch-out" },
      }),
      depth: 0,
      signal: new AbortController().signal,
      deps: {
        resolveAgentConfig: (id) => (id === roleplay.id ? roleplay : null),
        resolveModelConfig: () => null,
        resolveWorktree: () =>
          ({
            getTextDocumentInfo(domain: string, id: string) {
              if (domain !== "manuscript" || id !== "ch-out") {
                throw new Error("missing");
              }
              return {
                domain: "manuscript",
                id: "ch-out",
                kind: "chapter",
                label: "第三章",
                displayPath: "卷一/第三章",
              };
            },
            getDocumentContentRevision() {
              return revision;
            },
            readChapter() {
              return storedContent;
            },
            writeChapter(_id: string, content: string) {
              storedContent = content;
              revision += 1;
            },
          }) as never,
        clientLabel: "test",
        parentSelectedModelId: "mock",
        parentSelectedReasoningLevel: null,
        parentAdapterKind: "mock",
        createBackend: () => createMockBackend("这是落盘正文。"),
      },
    });

    expect(result.errorMessage).toBeNull();
    const json = JSON.parse(result.resultText!) as {
      status: string;
      report: string;
      output: { written: boolean; target: { id: string }; stats: { char_count: number } };
      artifacts: { wrote: boolean; touched_node_ids: string[] };
    };
    expect(json.status).toBe("completed");
    expect(json.report).toBe("");
    expect(json.output.written).toBe(true);
    expect(json.output.target.id).toBe("ch-out");
    expect(json.output.stats.char_count).toBe(7);
    expect(json.artifacts.wrote).toBe(true);
    expect(storedContent).toBe("这是落盘正文。");
    expect(result.view?.kind === "subagent" ? result.view.report : null).toBe("这是落盘正文。");
  });

  test("returns failed when output_target set but report empty", async () => {
    const roleplay: AiAgentRuntimeConfig = {
      id: "builtin-roleplay",
      name: "角色扮演",
      description: "纯文本",
      defaultDescription: "纯文本",
      systemPrompt: "你是创意人格",
      defaultSystemPrompt: "你是创意人格",
      defaultModelId: null,
      availableToolNames: [],
      builtin: true,
      userSelectable: false,
      subagentEligible: true,
      textOnlyMode: true,
    };

    const result = await executeSubagentToolCall({
      call: toolCall({
        agent_id: roleplay.id,
        task: "写出正文",
        output_target: { domain: "manuscript", id: "ch-out" },
      }),
      depth: 0,
      signal: new AbortController().signal,
      deps: {
        resolveAgentConfig: (id) => (id === roleplay.id ? roleplay : null),
        resolveModelConfig: () => null,
        resolveWorktree: () =>
          ({
            getTextDocumentInfo() {
              return {
                domain: "manuscript",
                id: "ch-out",
                kind: "chapter",
                label: "第三章",
                displayPath: "卷一/第三章",
              };
            },
            getDocumentContentRevision: () => 0,
            readChapter: () => "",
            writeChapter: () => {},
          }) as never,
        clientLabel: "test",
        parentSelectedModelId: "mock",
        parentSelectedReasoningLevel: null,
        parentAdapterKind: "mock",
        createBackend: () => createMockBackend("   "),
      },
    });

    const json = JSON.parse(result.resultText!) as { status: string; error: string };
    expect(json.status).toBe("failed");
    expect(json.error).toContain("未产出正文");
  });

  test("keeps report when output_target write fails", async () => {
    const roleplay: AiAgentRuntimeConfig = {
      id: "builtin-roleplay",
      name: "角色扮演",
      description: "纯文本",
      defaultDescription: "纯文本",
      systemPrompt: "你是创意人格",
      defaultSystemPrompt: "你是创意人格",
      defaultModelId: null,
      availableToolNames: [],
      builtin: true,
      userSelectable: false,
      subagentEligible: true,
      textOnlyMode: true,
    };

    const result = await executeSubagentToolCall({
      call: toolCall({
        agent_id: roleplay.id,
        task: "写出正文",
        output_target: { domain: "manuscript", id: "ch-out" },
      }),
      depth: 0,
      signal: new AbortController().signal,
      deps: {
        resolveAgentConfig: (id) => (id === roleplay.id ? roleplay : null),
        resolveModelConfig: () => null,
        resolveWorktree: () =>
          ({
            getTextDocumentInfo() {
              return {
                domain: "manuscript",
                id: "ch-out",
                kind: "chapter",
                label: "第三章",
                displayPath: "卷一/第三章",
              };
            },
            getDocumentContentRevision: () => 5,
            readChapter: () => "旧内容",
            writeChapter: () => {
              throw new Error("写入被拒绝");
            },
          }) as never,
        clientLabel: "test",
        parentSelectedModelId: "mock",
        parentSelectedReasoningLevel: null,
        parentAdapterKind: "mock",
        createBackend: () => createMockBackend("落盘失败时的正文"),
      },
    });

    const json = JSON.parse(result.resultText!) as {
      status: string;
      report: string;
      output: { written: boolean; error: string };
    };
    expect(json.status).toBe("completed");
    expect(json.report).toBe("落盘失败时的正文");
    expect(json.output.written).toBe(false);
    expect(json.output.error).toContain("写入被拒绝");
  });
});
