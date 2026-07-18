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

/**
 * Portable reasoning / thinking effort levels (aligned with `@codehz/ai` ReasoningLevel).
 * Mapped per-adapter to provider wire fields (Responses `reasoning.effort`, etc.).
 */
export type AiReasoningLevel = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export const AI_REASONING_LEVELS: readonly AiReasoningLevel[] = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const;

export const AI_REASONING_LEVEL_LABELS: Record<AiReasoningLevel, string> = {
  none: "关闭",
  minimal: "极低",
  low: "低",
  medium: "中",
  high: "高",
  xhigh: "极高",
  max: "最大",
};

export function isAiReasoningLevel(value: unknown): value is AiReasoningLevel {
  return typeof value === "string" && (AI_REASONING_LEVELS as readonly string[]).includes(value);
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
  /**
   * Model context window size in tokens for UI usage ratio.
   * `null` means not configured (do not show context occupancy).
   */
  contextLength: number | null;
  /**
   * Reasoning effort levels exposed for this model (subset of AI_REASONING_LEVELS).
   * Empty array means the model does not support / expose reasoning effort UI.
   */
  availableReasoningLevels: AiReasoningLevel[];
  /**
   * Default reasoning effort among exposed levels.
   * - Empty `availableReasoningLevels` → must be `null` (request omits reasoningLevel).
   * - Non-empty available → always a member of that set (never "no default").
   */
  defaultReasoningLevel: AiReasoningLevel | null;
  /**
   * Extra HTTP headers for the provider adapter (constructor-time).
   * Empty object means not configured.
   */
  headers: Record<string, string>;
  /**
   * Extra top-level JSON body fields for the provider adapter (constructor-time).
   * Empty object means not configured. Shallow-merged; same-name keys may override built-ins.
   */
  extraBody: Record<string, unknown>;
};

export type AiModelConfigWrite = {
  id?: string;
  providerId: string;
  name: string;
  model: string;
  maxOutputTokens: number;
  /** Omit, null, or 0 → not configured. */
  contextLength?: number | null;
  /**
   * Full replace of exposed reasoning levels.
   * Omit or `[]` → no reasoning effort UI / not configured.
   */
  availableReasoningLevels?: AiReasoningLevel[];
  /**
   * Default among available levels.
   * - Available empty → coerced to `null`.
   * - Available non-empty → required member of available (omit / null / out-of-set
   *   is filled with the first available level on write / load).
   */
  defaultReasoningLevel?: AiReasoningLevel | null;
  /** Full replace; omit or `{}` → clear / not configured. */
  headers?: Record<string, string>;
  /** Full replace; omit or `{}` → clear / not configured. */
  extraBody?: Record<string, unknown>;
};

export type AiModelsSettingsSnapshot = {
  defaultModelId: string | null;
  providers: AiProviderConfigPublic[];
  models: AiModelConfigPublic[];
};

export const BUILTIN_AI_AGENT_ID = "builtin-writing-assistant" as const;
export const BUILTIN_CONSISTENCY_REVIEWER_ID = "builtin-consistency-reviewer" as const;
export const BUILTIN_CHAPTER_WRITER_ID = "builtin-chapter-writer" as const;

export const BUILTIN_AI_AGENT_IDS = [
  BUILTIN_AI_AGENT_ID,
  BUILTIN_CONSISTENCY_REVIEWER_ID,
  BUILTIN_CHAPTER_WRITER_ID,
] as const;

export type BuiltinAiAgentId = (typeof BUILTIN_AI_AGENT_IDS)[number];

export function isBuiltinAiAgentId(id: string): id is BuiltinAiAgentId {
  return (BUILTIN_AI_AGENT_IDS as readonly string[]).includes(id);
}

export type AiAgentTool = {
  name: string;
  description: string;
};

export type AiAgentConfigPublic = {
  id: string;
  name: string;
  systemPrompt: string;
  defaultModelId: string | null;
  availableToolNames: string[];
  builtin: boolean;
};

/**
 * Create/update payload for `upsertAiAgent`.
 * When `id` is a builtin agent id, only `defaultModelId` is applied;
 * name / systemPrompt / availableToolNames are ignored.
 */
export type AiAgentConfigWrite = {
  id?: string;
  name: string;
  systemPrompt: string;
  defaultModelId: string | null;
  availableToolNames: string[];
};

export type AiAgentsSettingsSnapshot = {
  agents: AiAgentConfigPublic[];
  tools: AiAgentTool[];
};

/**
 * User-defined reusable prompt template.
 * Invoked later from the AI chat composer via `/{slug}` (composer wiring is out of scope here).
 */
export type AiPromptConfigPublic = {
  id: string;
  /** Human-readable title shown in settings list. */
  title: string;
  /**
   * Slash-command name without leading `/`.
   * Must match `^[a-z][a-z0-9_-]*$` and be unique among prompts.
   */
  slug: string;
  /** Prompt body inserted / sent when the slash command is used. */
  prompt: string;
};

export type AiPromptConfigWrite = {
  id?: string;
  title: string;
  slug: string;
  prompt: string;
};

export type AiPromptsSettingsSnapshot = {
  prompts: AiPromptConfigPublic[];
};

/** ASCII identifier for prompt slash commands (no leading `/`). */
export const AI_PROMPT_SLUG_PATTERN = /^[a-z][a-z0-9_-]*$/;

export function isAiPromptSlug(value: unknown): value is string {
  return typeof value === "string" && AI_PROMPT_SLUG_PATTERN.test(value);
}

export interface SettingsService extends RpcTarget {
  getAiModels(): AiModelsSettingsSnapshot;
  upsertAiProvider(input: AiProviderConfigWrite): AiModelsSettingsSnapshot;
  removeAiProvider(id: string): AiModelsSettingsSnapshot;
  upsertAiModel(input: AiModelConfigWrite): AiModelsSettingsSnapshot;
  removeAiModel(id: string): AiModelsSettingsSnapshot;
  setDefaultAiModel(id: string | null): AiModelsSettingsSnapshot;
  getAiAgents(): AiAgentsSettingsSnapshot;
  upsertAiAgent(input: AiAgentConfigWrite): AiAgentsSettingsSnapshot;
  removeAiAgent(id: string): AiAgentsSettingsSnapshot;
  getAiPrompts(): AiPromptsSettingsSnapshot;
  upsertAiPrompt(input: AiPromptConfigWrite): AiPromptsSettingsSnapshot;
  removeAiPrompt(id: string): AiPromptsSettingsSnapshot;
}
