/** Tool name used by the orchestrator to spawn a nested specialist run. */
export const RUN_SUBAGENT_TOOL_NAME = "run_subagent" as const;

/**
 * Ensure the target agent is allowed to run as a nested subagent.
 * Custom agents may opt out; builtin writing assistant is never eligible.
 */
export function assertSubagentEligible(agent: { name: string; subagentEligible: boolean }): void {
  if (!agent.subagentEligible) {
    throw new Error(`Agent「${agent.name}」不可用作子代理。`);
  }
}

/** Nested subagent runs are depth-0 only (no further spawn). */
export const MAX_SUBAGENT_DEPTH = 1;

/** Independent tool-loop budget for a single subagent run. */
export const MAX_SUBAGENT_TOOL_ROUNDS = 8;

/** Hard cap on parent_summary forwarded into the child context. */
export const MAX_PARENT_SUMMARY_CHARS = 2000;

/** Max focus targets whose content is auto-injected into a subagent prompt. */
export const MAX_FOCUS_TARGETS = 8;

/**
 * Per text-node char budget when injecting focus content.
 * Longer bodies are truncated with a note to call read_document.
 */
export const MAX_FOCUS_CONTENT_CHARS = 40_000;

/** Tools that must never appear on a subagent tool list (MVP). */
export const SUBAGENT_STRIPPED_TOOLS = new Set<string>([RUN_SUBAGENT_TOOL_NAME, "ask_user"]);

/**
 * Filter a target agent's tool whitelist for nested execution.
 * Always strips spawn + ask_user regardless of the target config.
 */
export function stripSubagentTools(toolNames: readonly string[]): string[] {
  return toolNames.filter((name) => !SUBAGENT_STRIPPED_TOOLS.has(name));
}

/** Resolve the tool whitelist for a nested subagent run (before selectAiTools). */
export function resolveSubagentEffectiveToolNames(agent: {
  textOnlyMode: boolean;
  availableToolNames: readonly string[];
}): string[] {
  if (agent.textOnlyMode) {
    return [];
  }
  return stripSubagentTools(agent.availableToolNames);
}

/**
 * Ensure the current nesting depth is legal before starting a subagent.
 * Parent orchestrator calls with depth 0; any nested call uses depth ≥ 1 and fails.
 */
export function assertSubagentDepth(depth: number): void {
  if (!Number.isInteger(depth) || depth < 0) {
    throw new Error("子代理 depth 必须是非负整数。");
  }
  if (depth >= MAX_SUBAGENT_DEPTH) {
    throw new Error(`子代理嵌套深度不能超过 ${MAX_SUBAGENT_DEPTH}。`);
  }
}

/**
 * Truncate optional parent_summary for child context.
 * Empty / whitespace-only becomes null.
 * `maxChars` defaults to the historical hard-coded budget so unit tests stay lean.
 */
export function truncateParentSummary(
  text: string | null | undefined,
  maxChars: number = MAX_PARENT_SUMMARY_CHARS,
): string | null {
  if (typeof text !== "string") {
    return null;
  }
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }
  const limit =
    Number.isFinite(maxChars) && maxChars > 0 ? Math.floor(maxChars) : MAX_PARENT_SUMMARY_CHARS;
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, limit)}…`;
}

/**
 * Resolve which model id the subagent should use.
 * Prefer the target agent's default when available; otherwise inherit the parent session model.
 */
export function resolveSubagentModelId(
  agentDefaultModelId: string | null | undefined,
  parentSelectedModelId: string,
  isModelAvailable: (modelId: string) => boolean,
): string {
  const preferred = agentDefaultModelId?.trim() ?? "";
  if (preferred !== "" && isModelAvailable(preferred)) {
    return preferred;
  }
  return parentSelectedModelId;
}
