import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { safeStorage } from "electron";
import { nanoid } from "nanoid";

import type {
  AiModelConfigWrite,
  AiModelsSettingsSnapshot,
  AiProviderConfigWrite,
} from "#domain/settings/ai-settings";
import type { AiModelRuntimeConfig as DomainModelRuntimeConfig } from "#domain/settings/stores/ai-models-state";
import {
  AI_MODELS_STATE_VERSION,
  AiModelsState,
  parseAiModelsState,
  type AiModelsStateData,
} from "#domain/settings/stores/ai-models-state";

export type AiModelRuntimeConfig = Omit<
  DomainModelRuntimeConfig,
  "providerHasApiKey" | "providerName"
>;

type StoredFile = {
  version: typeof AI_MODELS_STATE_VERSION;
  defaultModelId: string | null;
  providers: Array<{
    id: string;
    name: string;
    kind: AiModelsStateData["providers"][number]["kind"];
    baseUrl: string;
    apiKeyCipher?: string;
  }>;
  models: AiModelsStateData["models"];
};

export function decryptApiKeyCipher(apiKeyCipher: string | undefined): string | null {
  if (!apiKeyCipher) {
    return null;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    return null;
  }
  try {
    return safeStorage.decryptString(Buffer.from(apiKeyCipher, "base64"));
  } catch {
    return null;
  }
}

function encryptApiKey(apiKey: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("系统密钥加密不可用，无法保存 API Key。请检查操作系统密钥环配置。");
  }
  return safeStorage.encryptString(apiKey).toString("base64");
}

export class AiModelsStore {
  readonly #filePath: string;
  readonly #state: AiModelsState;
  #ciphers = new Map<string, string>();

  constructor(filePath: string) {
    this.#filePath = filePath;
    const loaded = this.#load();
    this.#ciphers = loaded.ciphers;
    this.#state = new AiModelsState({
      createId: () => nanoid(12),
      data: loaded.data,
    });
  }

  getSnapshot(): AiModelsSettingsSnapshot {
    return this.#state.getSnapshot();
  }

  upsertProvider(input: AiProviderConfigWrite): AiModelsSettingsSnapshot {
    const snapshot = this.#state.upsertProvider(input);
    this.#persist();
    return snapshot;
  }

  removeProvider(id: string): AiModelsSettingsSnapshot {
    const snapshot = this.#state.removeProvider(id);
    this.#ciphers.delete(id);
    this.#persist();
    return snapshot;
  }

  upsertModel(input: AiModelConfigWrite): AiModelsSettingsSnapshot {
    const snapshot = this.#state.upsertModel(input);
    this.#persist();
    return snapshot;
  }

  removeModel(id: string): AiModelsSettingsSnapshot {
    const snapshot = this.#state.removeModel(id);
    this.#persist();
    return snapshot;
  }

  setDefault(id: string | null): AiModelsSettingsSnapshot {
    const snapshot = this.#state.setDefault(id);
    this.#persist();
    return snapshot;
  }

  getRuntimeConfig(id: string): AiModelRuntimeConfig | null {
    const record = this.#state.getRuntimeConfig(id);
    if (!record) {
      return null;
    }
    if (record.providerHasApiKey && record.apiKey === null) {
      throw new Error(`供应商“${record.providerName}”的 API Key 无法解密，请在设置中重新保存。`);
    }
    const { providerHasApiKey: _has, providerName: _name, ...runtime } = record;
    return runtime;
  }

  #load(): { data: AiModelsStateData; ciphers: Map<string, string> } {
    const ciphers = new Map<string, string>();
    if (!existsSync(this.#filePath)) {
      return { data: parseAiModelsState(null), ciphers };
    }
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.#filePath, "utf8"));
      if (parsed === null || typeof parsed !== "object") {
        return { data: parseAiModelsState(null), ciphers };
      }
      const record = parsed as Record<string, unknown>;
      if (record.version !== AI_MODELS_STATE_VERSION) {
        return { data: parseAiModelsState(null), ciphers };
      }

      const providersRaw = Array.isArray(record.providers) ? record.providers : [];
      const providers = providersRaw.map((item) => {
        if (item === null || typeof item !== "object") {
          return item;
        }
        const entry = item as Record<string, unknown>;
        const cipher = typeof entry.apiKeyCipher === "string" ? entry.apiKeyCipher : undefined;
        if (typeof entry.id === "string" && cipher) {
          ciphers.set(entry.id, cipher);
        }
        const apiKey = decryptApiKeyCipher(cipher);
        return {
          ...entry,
          apiKey: apiKey ?? undefined,
          hasApiKey: Boolean(cipher),
        };
      });

      return {
        data: parseAiModelsState({
          defaultModelId: record.defaultModelId,
          providers,
          models: record.models,
        }),
        ciphers,
      };
    } catch {
      return { data: parseAiModelsState(null), ciphers };
    }
  }

  #persist(): void {
    const dir = dirname(this.#filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const data = this.#state.serialize();
    const payload: StoredFile = {
      version: AI_MODELS_STATE_VERSION,
      defaultModelId: data.defaultModelId,
      providers: data.providers.map((entry) => {
        let apiKeyCipher: string | undefined;
        if (entry.apiKey) {
          apiKeyCipher = encryptApiKey(entry.apiKey);
          this.#ciphers.set(entry.id, apiKeyCipher);
        } else if (entry.hasApiKey) {
          apiKeyCipher = this.#ciphers.get(entry.id);
        } else {
          this.#ciphers.delete(entry.id);
        }
        return {
          id: entry.id,
          name: entry.name,
          kind: entry.kind,
          baseUrl: entry.baseUrl,
          ...(apiKeyCipher ? { apiKeyCipher } : {}),
        };
      }),
      models: data.models,
    };

    writeFileSync(this.#filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }
}
