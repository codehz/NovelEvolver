import type { RpcTarget } from "capnweb";

/** User-configurable adapter kinds from `@codehz/ai` (excludes `mock`). */
export type AiAdapterKind = "responses" | "chat-completions" | "messages" | "ollama";

export const AI_ADAPTER_KINDS: readonly AiAdapterKind[] = [
  "responses",
  "chat-completions",
  "messages",
  "ollama",
] as const;

/** Default max output tokens for new models and legacy configs without the field. */
export const DEFAULT_AI_MODEL_MAX_OUTPUT_TOKENS = 4096;

/** Novel agent: at or below this limit is considered too small for long-form writing. */
export const AI_MODEL_MAX_OUTPUT_TOKENS_LOW_THRESHOLD = 4096;

export function isLowMaxOutputTokensForNovelAgent(maxOutputTokens: number): boolean {
  return maxOutputTokens <= AI_MODEL_MAX_OUTPUT_TOKENS_LOW_THRESHOLD;
}

/** API 供应商（连接与密钥），不含具体模型。 */
export type AiProviderConfigPublic = {
  id: string;
  name: string;
  kind: AiAdapterKind;
  /** Empty string means adapter default endpoint. */
  baseUrl: string;
  hasApiKey: boolean;
};

/**
 * 供应商写入。
 * - `id` omitted → create
 * - `apiKey` undefined → keep existing secret
 * - `apiKey` `""` → clear secret
 */
export type AiProviderConfigWrite = {
  id?: string;
  name: string;
  kind: AiAdapterKind;
  baseUrl?: string;
  apiKey?: string;
};

/** 模型条目，归属某一供应商。 */
export type AiModelConfigPublic = {
  id: string;
  providerId: string;
  name: string;
  /** Provider API model id. */
  model: string;
  maxOutputTokens: number;
};

export type AiModelConfigWrite = {
  id?: string;
  providerId: string;
  name: string;
  model: string;
  maxOutputTokens: number;
};

export type AiModelsSettingsSnapshot = {
  defaultModelId: string | null;
  providers: AiProviderConfigPublic[];
  models: AiModelConfigPublic[];
};

export interface SettingsService extends RpcTarget {
  getAiModels(): AiModelsSettingsSnapshot;
  upsertAiProvider(input: AiProviderConfigWrite): AiModelsSettingsSnapshot;
  removeAiProvider(id: string): AiModelsSettingsSnapshot;
  upsertAiModel(input: AiModelConfigWrite): AiModelsSettingsSnapshot;
  removeAiModel(id: string): AiModelsSettingsSnapshot;
  setDefaultAiModel(id: string | null): AiModelsSettingsSnapshot;
}
