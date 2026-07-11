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

/** Public model config — never includes a plaintext API key. */
export type AiModelConfigPublic = {
  id: string;
  name: string;
  kind: AiAdapterKind;
  model: string;
  /** Empty string means adapter default endpoint. */
  baseUrl: string;
  hasApiKey: boolean;
  maxOutputTokens: number;
};

export type AiModelsSettingsSnapshot = {
  defaultModelId: string | null;
  models: AiModelConfigPublic[];
};

/**
 * Write payload for create/update.
 * - `id` omitted → create
 * - `apiKey` undefined → keep existing secret
 * - `apiKey` `""` → clear secret
 * - `apiKey` non-empty → encrypt and replace
 */
export type AiModelConfigWrite = {
  id?: string;
  name: string;
  kind: AiAdapterKind;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  maxOutputTokens: number;
};

export interface SettingsService extends RpcTarget {
  getAiModels(): AiModelsSettingsSnapshot;
  upsertAiModel(input: AiModelConfigWrite): AiModelsSettingsSnapshot;
  removeAiModel(id: string): AiModelsSettingsSnapshot;
  setDefaultAiModel(id: string | null): AiModelsSettingsSnapshot;
}
