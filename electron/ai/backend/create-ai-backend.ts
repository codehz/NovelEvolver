import { AI_INSTRUCTIONS, AI_MODEL, createMockClient } from "../mock-adapter";
import { getMockScenario } from "../mock/scenario-registry";
import { MOCK_AI_INSTRUCTIONS, MOCK_AI_MODEL, createScenarioClient } from "../mock/scenario-runner";
import type { MockScenarioPacing } from "../mock/scenario-types";
import type { AiBackendSession } from "./ai-backend-session";

export function createAiBackendSession(options: {
  clientLabel: string;
  scenarioId?: string | null;
  pacing?: MockScenarioPacing;
}): AiBackendSession {
  if (options.scenarioId) {
    const scenario = getMockScenario(options.scenarioId);
    return {
      adapterKind: "mock",
      model: MOCK_AI_MODEL,
      instructions: MOCK_AI_INSTRUCTIONS,
      client: createScenarioClient({
        scenario,
        pacing: options.pacing ?? "preview",
        clientLabel: options.clientLabel,
      }),
      scenarioId: scenario.id,
    };
  }

  return {
    adapterKind: "mock",
    model: AI_MODEL,
    instructions: AI_INSTRUCTIONS,
    client: createMockClient(options.clientLabel),
    scenarioId: null,
  };
}
