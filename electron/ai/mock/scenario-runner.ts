import { MockAdapter, createAIClient } from "@codehz/ai";
import type { AIClient, MockStep } from "@codehz/ai";

import type { MockScenarioDefinition, MockScenarioPacing } from "./scenario-types";

export const MOCK_AI_MODEL = "mock-scenario-runner";
export const MOCK_AI_INSTRUCTIONS =
  "NovelEvolver mock AI scenario runner. Output is deterministic test data.";

function applyPacing(step: MockStep, pacing: MockScenarioPacing): MockStep {
  if (step.type !== "message" && step.type !== "reasoning" && step.type !== "tool_call") {
    return step;
  }
  if (pacing === "instant") {
    return { ...step, stream: false };
  }
  return {
    ...step,
    stream: {
      charsPerSecond: step.type === "tool_call" ? 80 : 48,
      chunkSize: step.type === "tool_call" ? 4 : 3,
      initialDelayMs: 60,
    },
  };
}

export function createScenarioClient(options: {
  scenario: MockScenarioDefinition;
  pacing: MockScenarioPacing;
  clientLabel: string;
}): AIClient {
  return createAIClient({
    adapter: new MockAdapter({
      handler: async function* (request) {
        const matches = options.scenario.turns.filter((turn) => turn.matches(request));
        if (matches.length !== 1) {
          const suffix =
            matches.length === 0 ? "no turn matched" : `${matches.length} turns matched`;
          throw new Error(`Mock scenario ${options.scenario.id}: ${suffix}.`);
        }

        for await (const step of matches[0]!.run({ request, clientLabel: options.clientLabel })) {
          yield applyPacing(step, options.pacing);
        }
      },
    }),
    model: MOCK_AI_MODEL,
  });
}
