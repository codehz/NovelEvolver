import type { RpcTarget } from "capnweb";

import type { MockAiScenarioSummary, RunMockAiScenarioRequest } from "#domain/ai/mock";

export interface MockAiControlHandle extends RpcTarget {
  listScenarios(): MockAiScenarioSummary[];
  runScenario(request: RunMockAiScenarioRequest): void;
  rerunActiveScenario(): void;
}
