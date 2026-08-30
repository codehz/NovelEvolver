import type { MockScenarioDefinition } from "./scenario-types";
import { MOCK_SCENARIOS } from "./scenarios";

const scenariosById = new Map<string, MockScenarioDefinition>();

for (const scenario of MOCK_SCENARIOS) {
  if (scenariosById.has(scenario.id)) {
    throw new Error(`Duplicate mock AI scenario id: ${scenario.id}`);
  }
  scenariosById.set(scenario.id, scenario);
}

export function listMockScenarios(): readonly MockScenarioDefinition[] {
  return MOCK_SCENARIOS;
}

export function getMockScenario(id: string): MockScenarioDefinition {
  const scenario = scenariosById.get(id);
  if (!scenario) {
    throw new Error(`Unknown mock AI scenario: ${id}`);
  }
  return scenario;
}
