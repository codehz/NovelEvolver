import type { MockAiScenarioSummary, RunMockAiScenarioRequest } from "@novelevolver/domain/ai/mock";
import type { RpcTarget } from "capnweb";

export interface MockAiControlHandle extends RpcTarget {
  listScenarios(): MockAiScenarioSummary[];
  runScenario(request: RunMockAiScenarioRequest): void;
  rerunActiveScenario(): void;
}
