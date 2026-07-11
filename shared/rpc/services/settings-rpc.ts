import type { RpcTarget } from "capnweb";

/** User-configurable adapter kinds from `@codehz/ai` (excludes `mock`). */
export type AiAdapterKind = "responses" | "chat-completions" | "messages" | "ollama";

export const AI_ADAPTER_KINDS: readonly AiAdapterKind[] = [
  "responses",
  "chat-completions",
  "messages",
  "ollama",
] as const;

/** Public model config — never includes a plaintext API key. */
export type AiModelConfigPublic = {
  id: string;
  name: string;
  kind: AiAdapterKind;
  model: string;
  /** Empty string means adapter default endpoint. */
  baseUrl: string;
  hasApiKey: boolean;
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
};

export interface SettingsService extends RpcTarget {
  getAiModels(): AiModelsSettingsSnapshot;
  upsertAiModel(input: AiModelConfigWrite): AiModelsSettingsSnapshot;
  removeAiModel(id: string): AiModelsSettingsSnapshot;
  setDefaultAiModel(id: string | null): AiModelsSettingsSnapshot;
}
