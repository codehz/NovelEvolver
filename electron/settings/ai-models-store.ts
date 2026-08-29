import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { safeStorage } from "electron";
import { nanoid } from "nanoid";

import type {
  AiAdapterKind,
  AiModelConfigPublic,
  AiModelConfigWrite,
  AiModelsSettingsSnapshot,
  AiPromptCacheConfig,
  AiProviderConfigPublic,
  AiProviderConfigWrite,
  AiReasoningLevel,
} from "#shared/rpc/services/index";
import {
  AI_ADAPTER_KINDS,
  AI_REASONING_LEVELS,
  DEFAULT_AI_MODEL_MAX_OUTPUT_TOKENS,
  isAiPromptCacheMode,
  isAiReasoningLevel,
} from "#shared/rpc/services/index";

const FILE_VERSION = 2 as const;

type StoredProviderRecord = {
  id: string;
  name: string;
  kind: AiAdapterKind;
  baseUrl: string;
  apiKeyCipher?: string;
};

type StoredModelRecord = {
  id: string;
  providerId: string;
  name: string;
  model: string;
  maxOutputTokens: number;
  contextLength: number | null;
  availableReasoningLevels: AiReasoningLevel[];
  defaultReasoningLevel: AiReasoningLevel | null;
  temperature: number | null;
  cache: AiPromptCacheConfig;
  headers: Record<string, string>;
  extraBody: Record<string, unknown>;
  supportsTools: boolean;
};

export type AiModelRuntimeConfig = {
  id: string;
  name: string;
  kind: AiAdapterKind;
  model: string;
  baseUrl: string;
  apiKey: string | null;
  maxOutputTokens: number;
  contextLength: number | null;
  availableReasoningLevels: AiReasoningLevel[];
  defaultReasoningLevel: AiReasoningLevel | null;
  temperature: number | null;
  cache: AiPromptCacheConfig;
  headers: Record<string, string>;
  extraBody: Record<string, unknown>;
  supportsTools: boolean;
};

const MAX_PROVIDER_OPTION_KEYS = 64;
const MAX_PROVIDER_OPTION_JSON_BYTES = 16 * 1024;

type StoredFile = {
  version: typeof FILE_VERSION;
  defaultModelId: string | null;
  providers: StoredProviderRecord[];
  models: StoredModelRecord[];
};

const EMPTY_FILE: StoredFile = {
  version: FILE_VERSION,
  defaultModelId: null,
  providers: [],
  models: [],
};

function isAiAdapterKind(value: unknown): value is AiAdapterKind {
  return typeof value === "string" && (AI_ADAPTER_KINDS as readonly string[]).includes(value);
}

function toProviderPublic(record: StoredProviderRecord): AiProviderConfigPublic {
  return {
    id: record.id,
    name: record.name,
    kind: record.kind,
    baseUrl: record.baseUrl,
    hasApiKey: Boolean(record.apiKeyCipher),
  };
}

function toModelPublic(record: StoredModelRecord): AiModelConfigPublic {
  return {
    id: record.id,
    providerId: record.providerId,
    name: record.name,
    model: record.model,
    maxOutputTokens: record.maxOutputTokens,
    contextLength: record.contextLength,
    availableReasoningLevels: [...record.availableReasoningLevels],
    defaultReasoningLevel: record.defaultReasoningLevel,
    temperature: record.temperature,
    cache: { ...record.cache },
    headers: { ...record.headers },
    extraBody: { ...record.extraBody },
    supportsTools: record.supportsTools,
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
      providers: this.#data.providers.map(toProviderPublic),
      models: this.#data.models.map(toModelPublic),
    };
  }

  upsertProvider(input: AiProviderConfigWrite): AiModelsSettingsSnapshot {
    const name = input.name.trim();
    const baseUrl = (input.baseUrl ?? "").trim();
    const kind = input.kind;

    if (name === "") {
      throw new Error("供应商名称不能为空。");
    }
    if (!isAiAdapterKind(kind)) {
      throw new Error("不支持的 API 形式。");
    }

    if (input.id) {
      const index = this.#data.providers.findIndex((entry) => entry.id === input.id);
      if (index < 0) {
        throw new Error("供应商不存在。");
      }

      const existing = this.#data.providers[index]!;
      let apiKeyCipher = existing.apiKeyCipher;

      if (input.apiKey !== undefined) {
        if (input.apiKey === "") {
          apiKeyCipher = undefined;
        } else {
          apiKeyCipher = encryptApiKey(input.apiKey);
        }
      }

      this.#data.providers[index] = {
        id: existing.id,
        name,
        kind,
        baseUrl,
        apiKeyCipher,
      };
    } else {
      let apiKeyCipher: string | undefined;
      if (input.apiKey !== undefined && input.apiKey !== "") {
        apiKeyCipher = encryptApiKey(input.apiKey);
      }

      this.#data.providers.push({
        id: nanoid(12),
        name,
        kind,
        baseUrl,
        apiKeyCipher,
      });
    }

    this.#persist();
    return this.getSnapshot();
  }

  removeProvider(id: string): AiModelsSettingsSnapshot {
    const hadProvider = this.#data.providers.some((entry) => entry.id === id);
    if (!hadProvider) {
      throw new Error("供应商不存在。");
    }

    const removedModelIds = new Set(
      this.#data.models.filter((entry) => entry.providerId === id).map((entry) => entry.id),
    );

    this.#data.providers = this.#data.providers.filter((entry) => entry.id !== id);
    this.#data.models = this.#data.models.filter((entry) => entry.providerId !== id);

    if (this.#data.defaultModelId && removedModelIds.has(this.#data.defaultModelId)) {
      this.#data.defaultModelId = null;
    }

    this.#persist();
    return this.getSnapshot();
  }

  upsertModel(input: AiModelConfigWrite): AiModelsSettingsSnapshot {
    const name = input.name.trim();
    const model = input.model.trim();
    const providerId = input.providerId.trim();

    if (name === "") {
      throw new Error("模型显示名称不能为空。");
    }
    if (model === "") {
      throw new Error("模型 ID 不能为空。");
    }
    if (providerId === "") {
      throw new Error("请选择供应商。");
    }
    if (!this.#data.providers.some((entry) => entry.id === providerId)) {
      throw new Error("供应商不存在。");
    }

    const maxOutputTokens = parseMaxOutputTokensFromWrite(input);
    const contextLength = parseContextLengthFromWrite(input);
    const availableReasoningLevels = parseAvailableReasoningLevelsFromWrite(input);
    const defaultReasoningLevel = parseDefaultReasoningLevelFromWrite(
      input,
      availableReasoningLevels,
    );
    const temperature = parseTemperatureFromWrite(input);
    const cache = parseCacheFromWrite(input);
    const headers = parseHeadersFromWrite(input);
    const extraBody = parseExtraBodyFromWrite(input);
    const supportsTools = parseSupportsToolsFromWrite(input);

    if (input.id) {
      const index = this.#data.models.findIndex((entry) => entry.id === input.id);
      if (index < 0) {
        throw new Error("模型配置不存在。");
      }

      const existing = this.#data.models[index]!;
      this.#data.models[index] = {
        id: existing.id,
        providerId,
        name,
        model,
        maxOutputTokens,
        contextLength,
        availableReasoningLevels,
        defaultReasoningLevel,
        temperature,
        cache,
        headers,
        extraBody,
        supportsTools,
      };
    } else {
      this.#data.models.push({
        id: nanoid(12),
        providerId,
        name,
        model,
        maxOutputTokens,
        contextLength,
        availableReasoningLevels,
        defaultReasoningLevel,
        temperature,
        cache,
        headers,
        extraBody,
        supportsTools,
      });
    }

    this.#persist();
    return this.getSnapshot();
  }

  removeModel(id: string): AiModelsSettingsSnapshot {
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

  getRuntimeConfig(id: string): AiModelRuntimeConfig | null {
    const record = this.#data.models.find((entry) => entry.id === id);
    if (!record) {
      return null;
    }

    const provider = this.#data.providers.find((entry) => entry.id === record.providerId);
    if (!provider) {
      return null;
    }

    const apiKey = decryptApiKeyCipher(provider.apiKeyCipher);
    if (provider.apiKeyCipher && apiKey === null) {
      throw new Error(`供应商“${provider.name}”的 API Key 无法解密，请在设置中重新保存。`);
    }

    return {
      id: record.id,
      name: record.name,
      kind: provider.kind,
      model: record.model,
      baseUrl: provider.baseUrl,
      apiKey,
      maxOutputTokens: record.maxOutputTokens,
      contextLength: record.contextLength,
      availableReasoningLevels: [...record.availableReasoningLevels],
      defaultReasoningLevel: record.defaultReasoningLevel,
      temperature: record.temperature,
      cache: { ...record.cache },
      headers: { ...record.headers },
      extraBody: { ...record.extraBody },
      supportsTools: record.supportsTools,
    };
  }

  #load(): StoredFile {
    if (!existsSync(this.#filePath)) {
      return { ...EMPTY_FILE };
    }

    try {
      const raw = readFileSync(this.#filePath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      return normalizeStoredFile(parsed);
    } catch {
      return { ...EMPTY_FILE };
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
      providers: this.#data.providers.map((entry) => ({
        id: entry.id,
        name: entry.name,
        kind: entry.kind,
        baseUrl: entry.baseUrl,
        ...(entry.apiKeyCipher ? { apiKeyCipher: entry.apiKeyCipher } : {}),
      })),
      models: this.#data.models.map((entry) => ({
        id: entry.id,
        providerId: entry.providerId,
        name: entry.name,
        model: entry.model,
        maxOutputTokens: entry.maxOutputTokens,
        contextLength: entry.contextLength,
        availableReasoningLevels: entry.availableReasoningLevels,
        defaultReasoningLevel: entry.defaultReasoningLevel,
        temperature: entry.temperature,
        cache: entry.cache,
        headers: entry.headers,
        extraBody: entry.extraBody,
        supportsTools: entry.supportsTools,
      })),
    };

    writeFileSync(this.#filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }
}

function normalizeStoredFile(value: unknown): StoredFile {
  if (value === null || typeof value !== "object") {
    return { ...EMPTY_FILE };
  }

  const record = value as Record<string, unknown>;
  if (record.version !== FILE_VERSION) {
    return { ...EMPTY_FILE };
  }

  const providersRaw = Array.isArray(record.providers) ? record.providers : [];
  const providers: StoredProviderRecord[] = [];

  for (const item of providersRaw) {
    if (item === null || typeof item !== "object") {
      continue;
    }
    const entry = item as Record<string, unknown>;
    if (
      typeof entry.id !== "string" ||
      typeof entry.name !== "string" ||
      !isAiAdapterKind(entry.kind)
    ) {
      continue;
    }

    providers.push({
      id: entry.id,
      name: entry.name,
      kind: entry.kind,
      baseUrl: typeof entry.baseUrl === "string" ? entry.baseUrl : "",
      apiKeyCipher: typeof entry.apiKeyCipher === "string" ? entry.apiKeyCipher : undefined,
    });
  }

  const providerIds = new Set(providers.map((entry) => entry.id));
  const modelsRaw = Array.isArray(record.models) ? record.models : [];
  const models: StoredModelRecord[] = [];

  for (const item of modelsRaw) {
    if (item === null || typeof item !== "object") {
      continue;
    }
    const entry = item as Record<string, unknown>;
    if (
      typeof entry.id !== "string" ||
      typeof entry.providerId !== "string" ||
      typeof entry.name !== "string" ||
      typeof entry.model !== "string" ||
      !providerIds.has(entry.providerId)
    ) {
      continue;
    }

    const availableReasoningLevels = normalizeAvailableReasoningLevels(
      entry.availableReasoningLevels,
    );
    models.push({
      id: entry.id,
      providerId: entry.providerId,
      name: entry.name,
      model: entry.model,
      maxOutputTokens: normalizeMaxOutputTokens(entry.maxOutputTokens),
      contextLength: normalizeContextLength(entry.contextLength),
      availableReasoningLevels,
      defaultReasoningLevel: normalizeDefaultReasoningLevel(
        entry.defaultReasoningLevel,
        availableReasoningLevels,
      ),
      temperature: normalizeTemperature(entry.temperature),
      cache: normalizeCache(entry.cache),
      headers: normalizeHeaders(entry.headers),
      extraBody: normalizeExtraBody(entry.extraBody),
      supportsTools: normalizeSupportsTools(entry.supportsTools),
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
    providers,
    models,
  };
}

function normalizeMaxOutputTokens(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_AI_MODEL_MAX_OUTPUT_TOKENS;
  }
  const rounded = Math.trunc(value);
  if (rounded < 1) {
    return DEFAULT_AI_MODEL_MAX_OUTPUT_TOKENS;
  }
  return rounded;
}

function parseMaxOutputTokensFromWrite(input: AiModelConfigWrite): number {
  const normalized = normalizeMaxOutputTokens(input.maxOutputTokens);
  if (normalized > 2_000_000) {
    throw new Error("最大输出 token 不能超过 2000000。");
  }
  return normalized;
}

/** Empty / 0 / missing → not configured (`null`). */
function normalizeContextLength(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.trunc(value);
  if (rounded < 1) {
    return null;
  }
  return rounded;
}

function parseContextLengthFromWrite(input: AiModelConfigWrite): number | null {
  const normalized = normalizeContextLength(input.contextLength);
  if (normalized !== null && normalized > 2_000_000) {
    throw new Error("上下文长度不能超过 2000000。");
  }
  return normalized;
}

/**
 * Missing / invalid → empty (no reasoning UI).
 * Dedupes and preserves AI_REASONING_LEVELS order.
 */
function normalizeAvailableReasoningLevels(value: unknown): AiReasoningLevel[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const selected = new Set<AiReasoningLevel>();
  for (const item of value) {
    if (isAiReasoningLevel(item)) {
      selected.add(item);
    }
  }
  return AI_REASONING_LEVELS.filter((level) => selected.has(level));
}

/**
 * Empty available → null.
 * Non-empty available → always a member (missing / invalid / out-of-set → first).
 */
function normalizeDefaultReasoningLevel(
  value: unknown,
  available: readonly AiReasoningLevel[],
): AiReasoningLevel | null {
  if (available.length === 0) {
    return null;
  }
  if (isAiReasoningLevel(value) && available.includes(value)) {
    return value;
  }
  return available[0]!;
}

function parseAvailableReasoningLevelsFromWrite(input: AiModelConfigWrite): AiReasoningLevel[] {
  if (input.availableReasoningLevels === undefined) {
    return [];
  }
  if (!Array.isArray(input.availableReasoningLevels)) {
    throw new Error("可用 reasoning effort 必须是数组。");
  }
  for (const item of input.availableReasoningLevels) {
    if (!isAiReasoningLevel(item)) {
      throw new Error(`不支持的 reasoning effort：${String(item)}。`);
    }
  }
  return normalizeAvailableReasoningLevels(input.availableReasoningLevels);
}

function parseDefaultReasoningLevelFromWrite(
  input: AiModelConfigWrite,
  available: readonly AiReasoningLevel[],
): AiReasoningLevel | null {
  if (available.length === 0) {
    return null;
  }
  if (input.defaultReasoningLevel === undefined || input.defaultReasoningLevel === null) {
    return available[0]!;
  }
  if (!isAiReasoningLevel(input.defaultReasoningLevel)) {
    throw new Error(`不支持的默认 reasoning effort：${String(input.defaultReasoningLevel)}。`);
  }
  if (!available.includes(input.defaultReasoningLevel)) {
    return available[0]!;
  }
  return input.defaultReasoningLevel;
}

const MAX_TEMPERATURE = 2;

/** Missing / invalid → not configured (`null`). */
function normalizeTemperature(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  if (value < 0 || value > MAX_TEMPERATURE) {
    return null;
  }
  return value;
}

function parseTemperatureFromWrite(input: AiModelConfigWrite): number | null {
  if (input.temperature === undefined || input.temperature === null) {
    return null;
  }
  if (typeof input.temperature !== "number" || !Number.isFinite(input.temperature)) {
    throw new Error("temperature 必须是数字。");
  }
  if (input.temperature < 0 || input.temperature > MAX_TEMPERATURE) {
    throw new Error(`temperature 必须在 0 到 ${MAX_TEMPERATURE} 之间。`);
  }
  return input.temperature;
}

/** Missing / invalid → empty object (not configured). */
function normalizeCache(value: unknown): AiPromptCacheConfig {
  if (!isPlainObject(value)) {
    return {};
  }

  const cache: AiPromptCacheConfig = {};
  if (isAiPromptCacheMode(value.mode)) {
    cache.mode = value.mode;
  }
  if (typeof value.key === "string") {
    const key = value.key.trim();
    if (key !== "") {
      cache.key = key;
    }
  }
  if (typeof value.ttl === "string") {
    const ttl = value.ttl.trim();
    if (ttl !== "") {
      cache.ttl = ttl;
    }
  }
  return cache;
}

function parseCacheFromWrite(input: AiModelConfigWrite): AiPromptCacheConfig {
  if (input.cache === undefined) {
    return {};
  }
  if (!isPlainObject(input.cache)) {
    throw new Error("cache 必须是对象。");
  }

  const cache: AiPromptCacheConfig = {};
  if (input.cache.mode !== undefined) {
    if (!isAiPromptCacheMode(input.cache.mode)) {
      throw new Error(`不支持的 prompt cache 策略：${String(input.cache.mode)}。`);
    }
    cache.mode = input.cache.mode;
  }
  if (input.cache.key !== undefined) {
    if (typeof input.cache.key !== "string") {
      throw new Error("cache.key 必须是字符串。");
    }
    const key = input.cache.key.trim();
    if (key !== "") {
      cache.key = key;
    }
  }
  if (input.cache.ttl !== undefined) {
    if (typeof input.cache.ttl !== "string") {
      throw new Error("cache.ttl 必须是字符串。");
    }
    const ttl = input.cache.ttl.trim();
    if (ttl !== "") {
      cache.ttl = ttl;
    }
  }
  return cache;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Missing / invalid → empty object (field-level degrade). */
function normalizeHeaders(value: unknown): Record<string, string> {
  if (!isPlainObject(value)) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof key !== "string" || key === "" || typeof entry !== "string") {
      continue;
    }
    result[key] = entry;
    if (Object.keys(result).length >= MAX_PROVIDER_OPTION_KEYS) {
      break;
    }
  }
  return result;
}

/** Missing / invalid → empty object (field-level degrade). */
function normalizeExtraBody(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value)) {
    return {};
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof key !== "string" || key === "") {
      continue;
    }
    result[key] = entry;
    if (Object.keys(result).length >= MAX_PROVIDER_OPTION_KEYS) {
      break;
    }
  }
  return result;
}

function assertProviderOptionSize(label: string, value: Record<string, unknown>): void {
  const keys = Object.keys(value);
  if (keys.length > MAX_PROVIDER_OPTION_KEYS) {
    throw new Error(`${label} 最多 ${MAX_PROVIDER_OPTION_KEYS} 个字段。`);
  }
  let json: string;
  try {
    json = JSON.stringify(value);
  } catch {
    throw new Error(`${label} 无法序列化为 JSON。`);
  }
  if (json.length > MAX_PROVIDER_OPTION_JSON_BYTES) {
    throw new Error(`${label} 序列化后不能超过 ${MAX_PROVIDER_OPTION_JSON_BYTES} 字节。`);
  }
}

function parseHeadersFromWrite(input: AiModelConfigWrite): Record<string, string> {
  if (input.headers === undefined) {
    return {};
  }
  if (!isPlainObject(input.headers)) {
    throw new Error("headers 必须是对象。");
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.headers)) {
    if (typeof key !== "string" || key.trim() === "") {
      throw new Error("headers 的键不能为空。");
    }
    if (typeof value !== "string") {
      throw new Error(`headers 的值必须是字符串（键：${key}）。`);
    }
    result[key] = value;
  }

  assertProviderOptionSize("headers", result);
  return result;
}

function parseExtraBodyFromWrite(input: AiModelConfigWrite): Record<string, unknown> {
  if (input.extraBody === undefined) {
    return {};
  }
  if (!isPlainObject(input.extraBody)) {
    throw new Error("extraBody 必须是对象。");
  }

  const result: Record<string, unknown> = { ...input.extraBody };
  assertProviderOptionSize("extraBody", result);
  return result;
}

function normalizeSupportsTools(value: unknown): boolean {
  return typeof value === "boolean" ? value : true;
}

function parseSupportsToolsFromWrite(input: AiModelConfigWrite): boolean {
  if (input.supportsTools === undefined) {
    return true;
  }
  if (typeof input.supportsTools !== "boolean") {
    throw new Error("supportsTools 必须是布尔值。");
  }
  return input.supportsTools;
}
