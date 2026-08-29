import type { RpcTarget } from "capnweb";

/** User-configurable adapter kinds from `@codehz/ai` (excludes `mock`). */
export type AiAdapterKind = "responses" | "chat-completions" | "messages" | "ollama" | "gemini";

export const AI_ADAPTER_KINDS: readonly AiAdapterKind[] = [
  "responses",
  "chat-completions",
  "messages",
  "ollama",
  "gemini",
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
  "max",
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

/** Portable prompt-cache strategy from `@codehz/ai` `PromptCacheSettings.mode`. */
export type AiPromptCacheMode = "off" | "auto" | "explicit";

export const AI_PROMPT_CACHE_MODES: readonly AiPromptCacheMode[] = [
  "off",
  "auto",
  "explicit",
] as const;

export const AI_PROMPT_CACHE_MODE_LABELS: Record<AiPromptCacheMode, string> = {
  off: "关闭",
  auto: "自动",
  explicit: "显式",
};

export function isAiPromptCacheMode(value: unknown): value is AiPromptCacheMode {
  return typeof value === "string" && (AI_PROMPT_CACHE_MODES as readonly string[]).includes(value);
}

/**
 * Model-level prompt cache defaults (request `cache`).
 * Empty object means not configured — omit `cache` on the request.
 */
export type AiPromptCacheConfig = {
  mode?: AiPromptCacheMode;
  /** Session / tenant routing hint; providers may ignore it. */
  key?: string;
  /** Portable retention (`short` / `long`) or a provider-native TTL string. */
  ttl?: string;
};

export function isAiPromptCacheConfigured(cache: AiPromptCacheConfig): boolean {
  return (
    cache.mode != null ||
    (typeof cache.key === "string" && cache.key.trim() !== "") ||
    (typeof cache.ttl === "string" && cache.ttl.trim() !== "")
  );
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
   * Sampling temperature for `AIRequest.temperature`.
   * `null` means not configured (omit on the request).
   */
  temperature: number | null;
  /**
   * Prompt-cache defaults for `AIRequest.cache`.
   * Empty object means not configured.
   */
  cache: AiPromptCacheConfig;
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
  /**
   * When false, the model must not receive tool definitions (function calling).
   * Omitted on legacy records → treated as true.
   */
  supportsTools: boolean;
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
  /** Omit, null → not configured. */
  temperature?: number | null;
  /** Full replace; omit or `{}` → clear / not configured. */
  cache?: AiPromptCacheConfig;
  /** Full replace; omit or `{}` → clear / not configured. */
  headers?: Record<string, string>;
  /** Full replace; omit or `{}` → clear / not configured. */
  extraBody?: Record<string, unknown>;
  /** Omit → true (tool-capable). */
  supportsTools?: boolean;
};

export type AiModelsSettingsSnapshot = {
  defaultModelId: string | null;
  providers: AiProviderConfigPublic[];
  models: AiModelConfigPublic[];
};

export const BUILTIN_AI_AGENT_ID = "builtin-writing-assistant" as const;
export const BUILTIN_CONSISTENCY_REVIEWER_ID = "builtin-consistency-reviewer" as const;
export const BUILTIN_CHAPTER_WRITER_ID = "builtin-chapter-writer" as const;
export const BUILTIN_ROLEPLAY_ID = "builtin-roleplay" as const;

export const BUILTIN_AI_AGENT_IDS = [
  BUILTIN_AI_AGENT_ID,
  BUILTIN_CONSISTENCY_REVIEWER_ID,
  BUILTIN_CHAPTER_WRITER_ID,
  BUILTIN_ROLEPLAY_ID,
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
  /** Short optional blurb for selectors / subagent catalog. Empty when unset. */
  description: string;
  /**
   * Code-defined baseline description for builtin agents;
   * `null` for custom agents.
   */
  defaultDescription: string | null;
  systemPrompt: string;
  /** Code-defined baseline for builtin agents; `null` for custom agents. */
  defaultSystemPrompt: string | null;
  defaultModelId: string | null;
  availableToolNames: string[];
  builtin: boolean;
  /** Shown in the chat agent selector when true. */
  userSelectable: boolean;
  /** Allowed as a `run_subagent` target when true. */
  subagentEligible: boolean;
  /**
   * Pure-text subagent: runtime omits tools even when `availableToolNames` is non-empty.
   * Meaningful only when `subagentEligible` is true.
   */
  textOnlyMode: boolean;
};

/**
 * Create/update payload for `upsertAiAgent`.
 * When `id` is a builtin agent id, only `description`, `systemPrompt`,
 * `defaultModelId`, `userSelectable`, and `subagentEligible` are applied.
 * Name / availableToolNames remain code-owned for builtins.
 */
export type AiAgentConfigWrite = {
  id?: string;
  name: string;
  description: string;
  systemPrompt: string;
  defaultModelId: string | null;
  availableToolNames: string[];
  userSelectable: boolean;
  subagentEligible: boolean;
  textOnlyMode: boolean;
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

/**
 * Global AI runtime budgets (tool loops + subagent focus injection).
 * Applied only to newly started requests / subagent runs — not mid-flight.
 * Subagent nesting depth remains code-owned and is not part of this policy.
 */
export type AiRuntimePolicySnapshot = {
  /** Parent orchestrator tool-loop budget per user request. */
  maxToolRounds: number;
  /** Independent tool-loop budget for a single `run_subagent` run. */
  maxSubagentToolRounds: number;
  /** Hard cap on parent_summary forwarded into the child context. */
  maxParentSummaryChars: number;
  /** Max focus targets whose content is auto-injected into a subagent prompt. */
  maxFocusTargets: number;
  /** Per text-node char budget when injecting focus content. */
  maxFocusContentChars: number;
};

/** Full-replace write payload (same shape as snapshot). */
export type AiRuntimePolicyWrite = AiRuntimePolicySnapshot;

/** Defaults aligned with historical hard-coded constants. */
export const DEFAULT_AI_RUNTIME_POLICY: AiRuntimePolicySnapshot = {
  maxToolRounds: 16,
  maxSubagentToolRounds: 8,
  maxParentSummaryChars: 2000,
  maxFocusTargets: 8,
  maxFocusContentChars: 40_000,
};

export type AiRuntimePolicyFieldLimit = {
  min: number;
  max: number;
};

/** Inclusive numeric bounds for each policy field. */
export const AI_RUNTIME_POLICY_LIMITS = {
  maxToolRounds: { min: 1, max: 64 },
  maxSubagentToolRounds: { min: 1, max: 32 },
  maxParentSummaryChars: { min: 200, max: 20_000 },
  maxFocusTargets: { min: 1, max: 32 },
  maxFocusContentChars: { min: 1000, max: 200_000 },
} as const satisfies Record<keyof AiRuntimePolicySnapshot, AiRuntimePolicyFieldLimit>;

function clampPolicyInt(
  value: unknown,
  fallback: number,
  limit: AiRuntimePolicyFieldLimit,
): number {
  const n =
    typeof value === "number" && Number.isFinite(value)
      ? Math.floor(value)
      : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))
        ? Math.floor(Number(value))
        : fallback;
  if (!Number.isInteger(n)) {
    return fallback;
  }
  return Math.min(limit.max, Math.max(limit.min, n));
}

/**
 * Coerce a partial / untrusted policy into a full snapshot.
 * Missing / non-numeric fields fall back to defaults; values are floored and clamped.
 */
export function normalizeAiRuntimePolicy(
  input: Partial<AiRuntimePolicyWrite> | null | undefined,
): AiRuntimePolicySnapshot {
  const source = input ?? {};
  return {
    maxToolRounds: clampPolicyInt(
      source.maxToolRounds,
      DEFAULT_AI_RUNTIME_POLICY.maxToolRounds,
      AI_RUNTIME_POLICY_LIMITS.maxToolRounds,
    ),
    maxSubagentToolRounds: clampPolicyInt(
      source.maxSubagentToolRounds,
      DEFAULT_AI_RUNTIME_POLICY.maxSubagentToolRounds,
      AI_RUNTIME_POLICY_LIMITS.maxSubagentToolRounds,
    ),
    maxParentSummaryChars: clampPolicyInt(
      source.maxParentSummaryChars,
      DEFAULT_AI_RUNTIME_POLICY.maxParentSummaryChars,
      AI_RUNTIME_POLICY_LIMITS.maxParentSummaryChars,
    ),
    maxFocusTargets: clampPolicyInt(
      source.maxFocusTargets,
      DEFAULT_AI_RUNTIME_POLICY.maxFocusTargets,
      AI_RUNTIME_POLICY_LIMITS.maxFocusTargets,
    ),
    maxFocusContentChars: clampPolicyInt(
      source.maxFocusContentChars,
      DEFAULT_AI_RUNTIME_POLICY.maxFocusContentChars,
      AI_RUNTIME_POLICY_LIMITS.maxFocusContentChars,
    ),
  };
}

/**
 * HTTPS Git host credentials (password / PAT), keyed by hostname.
 * Secrets are never returned over RPC — only `hasSecret`.
 */
export type GitCredentialConfigPublic = {
  id: string;
  /** Lowercase hostname only (no scheme, path, or port). */
  host: string;
  username: string;
  hasSecret: boolean;
};

/**
 * Create/update payload for `upsertGitCredential`.
 * - `id` omitted → create
 * - `secret` undefined → keep existing secret
 * - `secret` `""` → clear secret
 * - `secret` non-empty → replace secret
 * Create requires a non-empty secret.
 */
export type GitCredentialConfigWrite = {
  id?: string;
  host: string;
  username: string;
  secret?: string;
};

export type GitCredentialsSettingsSnapshot = {
  credentials: GitCredentialConfigPublic[];
};

/**
 * Basic hostname shape: labels of alphanumerics / hyphen, joined by dots.
 * Leading/trailing hyphens and empty labels are rejected. No IP literals.
 */
export const GIT_CREDENTIAL_HOST_PATTERN =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/;

export function isGitCredentialHost(value: unknown): value is string {
  return typeof value === "string" && value !== "" && GIT_CREDENTIAL_HOST_PATTERN.test(value);
}

/**
 * Normalize user input to a lowercase hostname.
 * Accepts bare hosts, `https://host/path`, `http://host:port/...`, and `git@host:path`.
 * Drops scheme, userinfo, path, query, fragment, and port. Does not read username from userinfo.
 */
export function normalizeGitCredentialHost(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") {
    throw new Error("域名不能为空。");
  }

  let candidate = trimmed;

  const scpMatch = candidate.match(/^[\w.-]+@([^/\s:]+)(?::.*)?$/);
  if (scpMatch) {
    candidate = scpMatch[1] ?? "";
  } else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    try {
      const url = new URL(candidate);
      candidate = url.hostname;
    } catch {
      throw new Error("无法解析域名，请输入主机名或完整远程 URL。");
    }
  } else {
    // Bare host, optional path/port: host, host/path, host:port, host:port/path
    const withoutPath = candidate.split(/[/?#]/, 1)[0] ?? "";
    const withoutPort = withoutPath.includes(":")
      ? (withoutPath.slice(0, withoutPath.indexOf(":")) ?? "")
      : withoutPath;
    candidate = withoutPort;
  }

  const host = candidate.trim().toLowerCase().replace(/\.$/, "");
  if (!isGitCredentialHost(host)) {
    throw new Error("域名格式无效，请输入如 github.com 的主机名。");
  }
  return host;
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
  getAiRuntimePolicy(): AiRuntimePolicySnapshot;
  setAiRuntimePolicy(input: AiRuntimePolicyWrite): AiRuntimePolicySnapshot;
  getGitCredentials(): GitCredentialsSettingsSnapshot;
  upsertGitCredential(input: GitCredentialConfigWrite): GitCredentialsSettingsSnapshot;
  removeGitCredential(id: string): GitCredentialsSettingsSnapshot;
}
