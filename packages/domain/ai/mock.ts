export type MockAiScenarioPacing = "preview" | "instant";
export type MockAiScenarioPersistence = "persistent" | "ephemeral";

export type MockAiScenarioSummary = {
  id: string;
  title: string;
  description: string;
  toolMode: "simulated" | "integrated";
  mutatesWorkspace: boolean;
};

export type RunMockAiScenarioRequest = {
  scenarioId: string;
  pacing: MockAiScenarioPacing;
  persistence: MockAiScenarioPersistence;
};
