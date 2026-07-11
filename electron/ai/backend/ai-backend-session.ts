import type { AIClient } from "@codehz/ai";

export type AiBackendSession = {
  adapterKind: "mock";
  model: string;
  instructions: string;
  client: AIClient;
  scenarioId: string | null;
};
