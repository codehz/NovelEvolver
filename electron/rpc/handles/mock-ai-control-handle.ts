import { RpcTarget } from "capnweb";

import type {
  MockAiControlHandle,
  MockAiScenarioSummary,
  RunMockAiScenarioRequest,
} from "#shared/rpc/ai/index";

import type { ProjectAiChatController } from "../../ai/chat/project-ai-chat";
import { listMockScenarios } from "../../ai/mock/scenario-registry";

export class MockAiControlHandleImpl extends RpcTarget implements MockAiControlHandle {
  readonly #chat: ProjectAiChatController;

  constructor(chat: ProjectAiChatController) {
    super();
    this.#chat = chat;
  }

  listScenarios(): MockAiScenarioSummary[] {
    return listMockScenarios().map((scenario) => ({
      id: scenario.id,
      title: scenario.title,
      description: scenario.description,
      toolMode: scenario.toolMode,
      mutatesWorkspace: scenario.mutatesWorkspace,
    }));
  }

  runScenario(request: RunMockAiScenarioRequest): void {
    this.#chat.runScenario(request);
  }

  rerunActiveScenario(): void {
    this.#chat.rerunActiveScenario();
  }
}
