import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { safeStorage } from "electron";
import { nanoid } from "nanoid";

import type {
  AiAdapterKind,
  AiModelConfigPublic,
  AiModelConfigWrite,
  AiModelsSettingsSnapshot,
} from "#shared/rpc/services/index";
import { AI_ADAPTER_KINDS } from "#shared/rpc/services/index";

const FILE_VERSION = 1 as const;

type StoredModelRecord = {
  id: string;
  name: string;
  kind: AiAdapterKind;
  model: string;
  baseUrl: string;
  /** Base64 of `safeStorage.encryptString`; empty/missing = no key. */
  apiKeyCipher?: string;
};

type StoredFile = {
  version: typeof FILE_VERSION;
  defaultModelId: string | null;
  models: StoredModelRecord[];
};

const EMPTY_FILE: StoredFile = {
  version: FILE_VERSION,
  defaultModelId: null,
  models: [],
};

function isAiAdapterKind(value: unknown): value is AiAdapterKind {
  return typeof value === "string" && (AI_ADAPTER_KINDS as readonly string[]).includes(value);
}

function toPublic(record: StoredModelRecord): AiModelConfigPublic {
  return {
    id: record.id,
    name: record.name,
    kind: record.kind,
    model: record.model,
    baseUrl: record.baseUrl,
    hasApiKey: Boolean(record.apiKeyCipher),
  };
}

function encryptApiKey(apiKey: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("系统密钥加密不可用，无法保存 API Key。请检查操作系统密钥环配置。");
  }
  return safeStorage.encryptString(apiKey).toString("base64");
}

/**
 * Decrypt a stored cipher for main-process runtime use (not exposed over RPC).
 * Returns null when missing or decryption fails.
 */
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

export class AiModelsStore {
  readonly #filePath: string;
  #data: StoredFile;

  constructor(filePath: string) {
    this.#filePath = filePath;
    this.#data = this.#load();
  }

  getSnapshot(): AiModelsSettingsSnapshot {
    return {
      defaultModelId: this.#data.defaultModelId,
      models: this.#data.models.map(toPublic),
    };
  }

  upsert(input: AiModelConfigWrite): AiModelsSettingsSnapshot {
    const name = input.name.trim();
    const model = input.model.trim();
    const baseUrl = (input.baseUrl ?? "").trim();
    const kind = input.kind;

    if (name === "") {
      throw new Error("显示名称不能为空。");
    }
    if (model === "") {
      throw new Error("模型 ID 不能为空。");
    }
    if (!isAiAdapterKind(kind)) {
      throw new Error("不支持的 API 形式。");
    }

    if (input.id) {
      const index = this.#data.models.findIndex((entry) => entry.id === input.id);
      if (index < 0) {
        throw new Error("模型配置不存在。");
      }

      const existing = this.#data.models[index]!;
      let apiKeyCipher = existing.apiKeyCipher;

      if (input.apiKey !== undefined) {
        if (input.apiKey === "") {
          apiKeyCipher = undefined;
        } else {
          apiKeyCipher = encryptApiKey(input.apiKey);
        }
      }

      this.#data.models[index] = {
        id: existing.id,
        name,
        kind,
        model,
        baseUrl,
        apiKeyCipher,
      };
    } else {
      let apiKeyCipher: string | undefined;
      if (input.apiKey !== undefined && input.apiKey !== "") {
        apiKeyCipher = encryptApiKey(input.apiKey);
      }

      this.#data.models.push({
        id: nanoid(12),
        name,
        kind,
        model,
        baseUrl,
        apiKeyCipher,
      });
    }

    this.#persist();
    return this.getSnapshot();
  }

  remove(id: string): AiModelsSettingsSnapshot {
    const next = this.#data.models.filter((entry) => entry.id !== id);
    if (next.length === this.#data.models.length) {
      throw new Error("模型配置不存在。");
    }

    this.#data.models = next;
    if (this.#data.defaultModelId === id) {
      this.#data.defaultModelId = null;
    }
    this.#persist();
    return this.getSnapshot();
  }

  setDefault(id: string | null): AiModelsSettingsSnapshot {
    if (id !== null) {
      const exists = this.#data.models.some((entry) => entry.id === id);
      if (!exists) {
        throw new Error("模型配置不存在。");
      }
    }
    this.#data.defaultModelId = id;
    this.#persist();
    return this.getSnapshot();
  }

  /**
   * Internal helper for a future real-adapter wiring step.
   * Not exposed over RPC.
   */
  getStoredRecord(id: string): StoredModelRecord | null {
    return this.#data.models.find((entry) => entry.id === id) ?? null;
  }

  #load(): StoredFile {
    if (!existsSync(this.#filePath)) {
      return { ...EMPTY_FILE, models: [] };
    }

    try {
      const raw = readFileSync(this.#filePath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      return normalizeStoredFile(parsed);
    } catch {
      return { ...EMPTY_FILE, models: [] };
    }
  }

  #persist(): void {
    const dir = dirname(this.#filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const payload: StoredFile = {
      version: FILE_VERSION,
      defaultModelId: this.#data.defaultModelId,
      models: this.#data.models.map((entry) => ({
        id: entry.id,
        name: entry.name,
        kind: entry.kind,
        model: entry.model,
        baseUrl: entry.baseUrl,
        ...(entry.apiKeyCipher ? { apiKeyCipher: entry.apiKeyCipher } : {}),
      })),
    };

    writeFileSync(this.#filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }
}

function normalizeStoredFile(value: unknown): StoredFile {
  if (value === null || typeof value !== "object") {
    return { ...EMPTY_FILE, models: [] };
  }

  const record = value as Record<string, unknown>;
  const modelsRaw = Array.isArray(record.models) ? record.models : [];
  const models: StoredModelRecord[] = [];

  for (const item of modelsRaw) {
    if (item === null || typeof item !== "object") {
      continue;
    }
    const entry = item as Record<string, unknown>;
    if (
      typeof entry.id !== "string" ||
      typeof entry.name !== "string" ||
      typeof entry.model !== "string" ||
      !isAiAdapterKind(entry.kind)
    ) {
      continue;
    }

    models.push({
      id: entry.id,
      name: entry.name,
      kind: entry.kind,
      model: entry.model,
      baseUrl: typeof entry.baseUrl === "string" ? entry.baseUrl : "",
      apiKeyCipher: typeof entry.apiKeyCipher === "string" ? entry.apiKeyCipher : undefined,
    });
  }

  let defaultModelId: string | null = null;
  if (typeof record.defaultModelId === "string") {
    if (models.some((entry) => entry.id === record.defaultModelId)) {
      defaultModelId = record.defaultModelId;
    }
  }

  return {
    version: FILE_VERSION,
    defaultModelId,
    models,
  };
}
