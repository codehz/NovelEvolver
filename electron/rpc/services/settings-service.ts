import { RpcTarget } from "capnweb";

import type {
  AiModelConfigWrite,
  AiModelsSettingsSnapshot,
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
}
