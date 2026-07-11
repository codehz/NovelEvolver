import type { MockStep, NormalizedRequest, ToolResultItem } from "@codehz/ai";

export type MockScenarioPacing = "preview" | "instant";
export type MockScenarioPersistence = "persistent" | "ephemeral";
export type MockScenarioToolMode = "simulated" | "integrated";

export type MockScenarioContext = {
  request: NormalizedRequest;
  clientLabel: string;
};

export type MockScenarioTurn = {
  id: string;
  matches: (request: NormalizedRequest) => boolean;
  run: (context: MockScenarioContext) => Iterable<MockStep> | AsyncIterable<MockStep>;
};

export type MockScenarioSimulatedResult = Pick<ToolResultItem, "outcome" | "content"> & {
  errorMessage?: string;
};

export type MockScenarioDefinition = {
  id: string;
  title: string;
  description: string;
  initialPrompt: string;
  toolMode: MockScenarioToolMode;
  mutatesWorkspace: boolean;
  turns: readonly MockScenarioTurn[];
  simulatedResults?: Readonly<Record<string, MockScenarioSimulatedResult>>;
};

export function hasToolResult(request: NormalizedRequest, callId: string): boolean {
  return request.input.some((item) => item.type === "tool_result" && item.callId === callId);
}

export function getToolResult(request: NormalizedRequest, callId: string): ToolResultItem | null {
  for (let index = request.input.length - 1; index >= 0; index--) {
    const item = request.input[index]!;
    if (item.type === "tool_result" && item.callId === callId) {
      return item;
    }
  }
  return null;
}

export function readToolResultText(result: ToolResultItem | null): string {
  if (!result) {
    return "";
  }
  return result.content
    .map((block) => {
      if (block.type === "text") {
        return block.text;
      }
      if (block.type === "json") {
        return JSON.stringify(block.json);
      }
      return "";
    })
    .join("\n");
}
