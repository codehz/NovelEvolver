import { describe, expect, it } from "bun:test";

import { collectStream, toolResultItem } from "@codehz/ai";
import type { InputItem } from "@codehz/ai";

import { shouldProcessToolCalls } from "../chat/conversation-runtime";
import type { ToolRunner } from "../tools/runner";
import { getMockScenario, listMockScenarios } from "./scenario-registry";
import { createScenarioClient } from "./scenario-runner";
import { createScenarioToolRunner } from "./scenario-tool-runner";
import type { MockScenarioDefinition } from "./scenario-types";

const initialInput: InputItem[] = [
  {
    type: "message",
    role: "user",
    content: [{ type: "text", text: "run scenario" }],
  },
];

describe("mock AI scenario registry", () => {
  it("has stable unique ids", () => {
    const ids = listMockScenarios().map((scenario) => scenario.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("stream.basic");
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
    expect(response.warnings).toContain("这是可恢复的测试警告，响应仍会继续。");
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
