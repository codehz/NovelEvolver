import { RpcTarget } from "capnweb";

import type {
  AiModelConfigWrite,
  AiModelsSettingsSnapshot,
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

  upsertAiModel(input: AiModelConfigWrite): AiModelsSettingsSnapshot {
    return this.#deps.getAiModelsStore().upsert(input);
  }

  removeAiModel(id: string): AiModelsSettingsSnapshot {
    return this.#deps.getAiModelsStore().remove(id);
  }

  setDefaultAiModel(id: string | null): AiModelsSettingsSnapshot {
    return this.#deps.getAiModelsStore().setDefault(id);
  }
}
