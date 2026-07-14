import { RpcTarget } from "capnweb";

import type {
  AiAgentConfigWrite,
  AiAgentsSettingsSnapshot,
  AiModelConfigWrite,
  AiModelsSettingsSnapshot,
  AiPromptConfigWrite,
  AiPromptsSettingsSnapshot,
  AiProviderConfigWrite,
  SettingsService,
} from "#shared/rpc/services/index";

import type { RpcMainDeps } from "../server/deps";

export class SettingsServiceImpl extends RpcTarget implements SettingsService {
  readonly #deps: RpcMainDeps;

  constructor(deps: RpcMainDeps) {
    super();
    this.#deps = deps;
  }

  getAiModels(): AiModelsSettingsSnapshot {
    return this.#deps.getAiModelsStore().getSnapshot();
  }

  upsertAiProvider(input: AiProviderConfigWrite): AiModelsSettingsSnapshot {
    return this.#deps.getAiModelsStore().upsertProvider(input);
  }

  removeAiProvider(id: string): AiModelsSettingsSnapshot {
    return this.#deps.getAiModelsStore().removeProvider(id);
  }

  upsertAiModel(input: AiModelConfigWrite): AiModelsSettingsSnapshot {
    return this.#deps.getAiModelsStore().upsertModel(input);
  }

  removeAiModel(id: string): AiModelsSettingsSnapshot {
    return this.#deps.getAiModelsStore().removeModel(id);
  }

  setDefaultAiModel(id: string | null): AiModelsSettingsSnapshot {
    return this.#deps.getAiModelsStore().setDefault(id);
  }

  getAiAgents(): AiAgentsSettingsSnapshot {
    return this.#deps.getAiAgentsStore().getSnapshot();
  }

  upsertAiAgent(input: AiAgentConfigWrite): AiAgentsSettingsSnapshot {
    return this.#deps.getAiAgentsStore().upsert(input);
  }

  removeAiAgent(id: string): AiAgentsSettingsSnapshot {
    return this.#deps.getAiAgentsStore().remove(id);
  }

  getAiPrompts(): AiPromptsSettingsSnapshot {
    return this.#deps.getAiPromptsStore().getSnapshot();
  }

  upsertAiPrompt(input: AiPromptConfigWrite): AiPromptsSettingsSnapshot {
    return this.#deps.getAiPromptsStore().upsert(input);
  }

  removeAiPrompt(id: string): AiPromptsSettingsSnapshot {
    return this.#deps.getAiPromptsStore().remove(id);
  }
}
