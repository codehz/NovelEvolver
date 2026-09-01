import { describe, expect, it } from "bun:test";

import { collectStream, toolResultItem } from "@codehz/ai";
import type { InputItem, ToolCallItem } from "@codehz/ai";

import { shouldProcessToolCalls } from "../chat/conversation-runtime";
import { buildSubagentUserMessage, executeSubagentToolCall } from "../chat/subagent";
import type { AiAgentRuntimeConfig } from "../ports";
import type { ToolRunner } from "../tools";
import { getMockScenario, listMockScenarios } from "./scenario-registry";
import { createScenarioClient } from "./scenario-runner";
import { createScenarioToolRunner } from "./scenario-tool-runner";
import { isSubagentRequest, type MockScenarioDefinition } from "./scenario-types";

const initialInput: InputItem[] = [
  {
    type: "message",
    role: "user",
    content: [{ type: "text", text: "run scenario" }],
  },
];

const reviewer: AiAgentRuntimeConfig = {
  id: "builtin-consistency-reviewer",
  name: "一致性审查",
  description: "对照设定与正文做只读一致性审查",
  defaultDescription: "对照设定与正文做只读一致性审查",
  systemPrompt: "你是审查员",
  defaultSystemPrompt: "你是审查员",
  defaultModelId: null,
  availableToolNames: ["read_document", "search_documents", "read_structure"],
  builtin: true,
  userSelectable: false,
  subagentEligible: true,
  textOnlyMode: false,
};

function subagentUserInput(task: string): InputItem[] {
  return [
    {
      type: "message",
      role: "user",
      content: [
        {
          type: "text",
          text: buildSubagentUserMessage(
            {
              agentId: reviewer.id,
              task,
              constraints: null,
              focus: [{ domain: "manuscript", id: "chapter-1" }],
              parentSummary: null,
              outputTarget: null,
            },
            reviewer.name,
          ),
        },
      ],
    },
  ];
}

function runSubagentCall(id: string, args: Record<string, unknown>): ToolCallItem {
  return {
    type: "tool_call",
    id,
    name: "run_subagent",
    argumentsText: JSON.stringify(args),
  };
}

describe("mock AI scenario registry", () => {
  it("has stable unique ids", () => {
    const ids = listMockScenarios().map((scenario) => scenario.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("stream.basic");
    expect(ids).toContain("subagent.basic");
    expect(ids).toContain("subagent.with-tool");
    expect(ids).toContain("subagent.failed");
  });
});

describe("isSubagentRequest", () => {
  it("detects isolated subagent user messages", () => {
    expect(isSubagentRequest({ input: initialInput })).toBe(false);
    expect(isSubagentRequest({ input: subagentUserInput("审查") })).toBe(true);
  });
});

describe("mock AI scenario runner", () => {
  it("runs a deterministic instant stream", async () => {
    const scenario = getMockScenario("stream.basic");
    const client = createScenarioClient({ scenario, pacing: "instant", clientLabel: "test" });
    const response = await collectStream(client.stream({ input: initialInput }));

    expect(response.stopReason).toBe("end_turn");
    expect(response.output.map((item) => item.id)).toEqual([
      "scenario-basic-reasoning-1",
      "scenario-basic-message-1",
      "scenario-basic-reasoning-2",
      "scenario-basic-message-2",
    ]);
    expect(response.usage?.totalTokens).toBe(78);
  });

  it("selects the follow-up turn from transcript tool results", async () => {
    const scenario = getMockScenario("tools.simulated-project-structure");
    const client = createScenarioClient({ scenario, pacing: "instant", clientLabel: "test" });
    const first = await collectStream(client.stream({ input: initialInput }));
    expect(first.toolCalls.map((call) => call.id)).toEqual(["scenario-simulated-structure"]);

    const result = toolResultItem("scenario-simulated-structure", "read_structure", "success", [
      { type: "json", json: { domain: "resource", resource: { root_id: "root", nodes: [] } } },
    ]);
    const second = await collectStream(
      client.stream({ input: [...initialInput, ...first.replay, result] }),
    );
    expect(second.text).toContain("模拟工具已返回固定数据");
    expect(second.toolCalls).toHaveLength(0);
  });

  it("reports an interrupted stream", async () => {
    const scenario = getMockScenario("errors.interrupted-stream");
    const client = createScenarioClient({ scenario, pacing: "instant", clientLabel: "test" });
    let streamError: unknown = null;
    try {
      await collectStream(client.stream({ input: initialInput }));
    } catch (error) {
      streamError = error;
    }
    expect(streamError).toBeInstanceOf(Error);
  });

  it("preserves provider warnings for the application state", async () => {
    const scenario = getMockScenario("errors.provider-warning");
    const client = createScenarioClient({ scenario, pacing: "instant", clientLabel: "test" });
    const response = await collectStream(client.stream({ input: initialInput }));
    expect(response.warnings?.map((warning) => warning.message)).toContain(
      "这是可恢复的测试警告，响应仍会继续。",
    );
    expect(response.text).toContain("正文已正常完成");
  });

  it("processes tool calls even when the response stops at the token limit", async () => {
    const scenario: MockScenarioDefinition = {
      id: "test.max-tokens-tool-call",
      title: "Token 上限工具调用",
      description: "模拟工具参数生成期间达到 token 上限。",
      initialPrompt: "生成一个被截断的工具调用。",
      toolMode: "simulated",
      mutatesWorkspace: false,
      turns: [
        {
          id: "truncated-tool-call",
          matches: () => true,
          run: function* () {
            yield {
              type: "tool_call",
              id: "scenario-truncated-tool-call",
              name: "write_document",
              argumentsText: '{"target":',
            };
            yield { type: "complete", stopReason: "max_output_tokens" };
          },
        },
      ],
    };
    const client = createScenarioClient({ scenario, pacing: "instant", clientLabel: "test" });
    const response = await collectStream(client.stream({ input: initialInput }));

    expect(response.stopReason).toBe("max_output_tokens");
    expect(response.toolCalls).toHaveLength(1);
    expect(shouldProcessToolCalls(response)).toBe(true);
  });
});

describe("scenario tool runner", () => {
  it("uses the fixed simulated result without invoking the real runner", async () => {
    const scenario = getMockScenario("tools.simulated-project-structure");
    const realRunner: ToolRunner = {
      async execute() {
        throw new Error("real runner must not execute");
      },
    };
    const runner = createScenarioToolRunner(realRunner, scenario);
    const execution = await runner.execute({
      type: "tool_call",
      id: "scenario-simulated-structure",
      name: "read_structure",
      argumentsText: "{}",
    });

    expect(execution.errorMessage).toBeNull();
    expect(execution.resultText).toContain("主角.md");
    expect(execution.toolResult.outcome).toBe("success");
  });
});

describe("subagent mock scenarios", () => {
  it("parent turn yields run_subagent and child turn returns a summary", async () => {
    const scenario = getMockScenario("subagent.basic");
    const client = createScenarioClient({ scenario, pacing: "instant", clientLabel: "test" });

    const parentFirst = await collectStream(client.stream({ input: initialInput }));
    expect(parentFirst.toolCalls).toHaveLength(1);
    expect(parentFirst.toolCalls[0]?.name).toBe("run_subagent");
    expect(parentFirst.toolCalls[0]?.id).toBe("scenario-subagent-basic");

    const child = await collectStream(
      client.stream({
        input: subagentUserInput("审查主角人设是否前后一致，给出简短结论。"),
      }),
    );
    expect(child.toolCalls).toHaveLength(0);
    expect(child.text).toContain("未发现明显人设冲突");
    expect(child.usage?.totalTokens).toBe(68);

    const parentResult = toolResultItem("scenario-subagent-basic", "run_subagent", "success", [
      {
        type: "json",
        json: {
          status: "completed",
          report: child.text,
          steps_digest: "",
          agent_id: reviewer.id,
          agent_name: reviewer.name,
        },
      },
    ]);
    const parentSecond = await collectStream(
      client.stream({ input: [...initialInput, ...parentFirst.replay, parentResult] }),
    );
    expect(parentSecond.text).toContain("子代理已返回");
    expect(parentSecond.text).toContain("未发现明显人设冲突");
  });

  it("child turn can call a tool then finish after the simulated result", async () => {
    const scenario = getMockScenario("subagent.with-tool");
    const client = createScenarioClient({ scenario, pacing: "instant", clientLabel: "test" });
    const childInput = subagentUserInput("读取第一章并判断开场是否自洽。");

    const childFirst = await collectStream(client.stream({ input: childInput }));
    expect(childFirst.toolCalls.map((call) => call.id)).toEqual(["scenario-subagent-child-read"]);
    expect(childFirst.toolCalls[0]?.name).toBe("read_document");

    const runner = createScenarioToolRunner(
      {
        async execute() {
          throw new Error("real runner must not execute");
        },
      },
      scenario,
    );
    const execution = await runner.execute(childFirst.toolCalls[0]!);
    expect(execution.errorMessage).toBeNull();
    expect(execution.resultText).toContain("雨夜");

    const childSecond = await collectStream(
      client.stream({
        input: [...childInput, ...childFirst.replay, execution.toolResult],
      }),
    );
    expect(childSecond.toolCalls).toHaveLength(0);
    expect(childSecond.text).toContain("雨夜开场");
  });

  it("executeSubagentToolCall completes via shared scenario client", async () => {
    const scenario = getMockScenario("subagent.basic");
    const phases: string[] = [];
    const result = await executeSubagentToolCall({
      call: runSubagentCall("scenario-subagent-basic", {
        agent_id: reviewer.id,
        task: "审查主角人设是否前后一致，给出简短结论。",
        constraints: "只读，不要改写文档。",
        focus: [{ domain: "manuscript", id: "chapter-1" }],
        parent_summary: "用户要求检查人设一致性。",
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
        scenarioId: scenario.id,
        scenarioPacing: "instant",
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
    expect(json.report).toContain("未发现明显人设冲突");
    expect(json.agent_name).toBe("一致性审查");
    expect(result.view?.kind).toBe("subagent");
    expect(phases[0]).toBe("starting");
    expect(phases).toContain("thinking");
    expect(phases.at(-1)).toBe("finalizing");
  });

  it("executeSubagentToolCall runs child tool rounds with simulated results", async () => {
    const scenario = getMockScenario("subagent.with-tool");
    const phases: string[] = [];
    const currentTools: Array<string | null> = [];
    const result = await executeSubagentToolCall({
      call: runSubagentCall("scenario-subagent-with-tool", {
        agent_id: reviewer.id,
        task: "读取第一章并判断开场是否自洽。",
        focus: [{ domain: "manuscript", id: "chapter-1" }],
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
        scenarioId: scenario.id,
        scenarioPacing: "instant",
        toolRunner: createScenarioToolRunner(
          {
            async execute() {
              throw new Error("real runner must not execute");
            },
          },
          scenario,
        ),
      },
      onProgress: (progress) => {
        phases.push(progress.phase);
        currentTools.push(progress.current_tool?.name ?? null);
      },
    });

    const json = JSON.parse(result.resultText!) as { status: string; report: string };
    expect(json.status).toBe("completed");
    expect(json.report).toContain("雨夜开场");
    expect(phases).toContain("tool");
    expect(currentTools).toContain("read_document");
    expect(result.view?.kind).toBe("subagent");
    if (result.view?.kind === "subagent") {
      expect(result.view.steps.some((step) => step.name === "read_document")).toBe(true);
    }
  });

  it("executeSubagentToolCall completes when child yields empty report", async () => {
    const scenario = getMockScenario("subagent.failed");
    const result = await executeSubagentToolCall({
      call: runSubagentCall("scenario-subagent-failed", {
        agent_id: reviewer.id,
        task: "允许无最终报告。",
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
        scenarioId: scenario.id,
        scenarioPacing: "instant",
      },
    });

    const json = JSON.parse(result.resultText!) as { status: string; report: string };
    expect(json.status).toBe("completed");
    expect(json.report).toBe("");
    expect(result.view?.kind).toBe("subagent");
  });
});
