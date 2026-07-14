import type {
  AiChatAssistantMessage,
  AiChatMessage,
  AiChatToolCall,
  AiChatWarning,
  AiChatSnapshot,
} from "#shared/rpc/ai/index";

/** Provider auxiliary warnings from `@codehz/ai` that are not actionable in the chat UI. */
const HIDDEN_AI_PROVIDER_WARNING_CODES = new Set<string>([
  "BILLING_MISSING",
  "USAGE_MISSING",
  "BILLING_ESTIMATED",
]);

export function isVisibleAiChatWarning(warning: AiChatWarning): boolean {
  return warning.code === null || !HIDDEN_AI_PROVIDER_WARNING_CODES.has(warning.code);
}

export function filterVisibleAiChatWarnings(warnings: readonly AiChatWarning[]): AiChatWarning[] {
  return warnings.filter(isVisibleAiChatWarning);
}

export function stripHiddenAiChatWarningsFromSnapshot(snapshot: AiChatSnapshot): AiChatSnapshot {
  const visible = filterVisibleAiChatWarnings(snapshot.warnings);
  if (visible.length === snapshot.warnings.length) {
    return snapshot;
  }
  return { ...snapshot, warnings: visible };
}

export function describeToolCallStatus(status: AiChatToolCall["status"]): string {
  switch (status) {
    case "pending":
      return "等待参数";
    case "running":
      return "执行中";
    case "awaiting_user":
      return "等待你的回答 ↓";
    case "complete":
      return "已完成";
    case "error":
      return "失败";
  }
}

/** Streaming process label for the assistant message footer (left-aligned). */
export function describeAssistantStreamingMeta(message: AiChatAssistantMessage): string {
  const hasRunningTool = message.parts.some(
    (part) => part.type === "tool_call" && part.status === "running",
  );
  const hasStreamingReasoning = message.parts.some(
    (part) => part.type === "reasoning" && part.status === "streaming",
  );
  return hasStreamingReasoning ? "思考中" : hasRunningTool ? "执行工具中" : "正在工作";
}

/** Completed-turn usage summary for hover on the model label. */
export function describeAssistantUsageMeta(message: AiChatAssistantMessage): string {
  const usage = message.usage;
  const inputTokens = usage?.inputTokens;
  const outputTokens = usage?.outputTokens;
  const hasInput = typeof inputTokens === "number";
  const hasOutput = typeof outputTokens === "number";

  if (hasInput || hasOutput) {
    const parts: string[] = [];
    if (hasInput) {
      const cached = usage?.cachedInputTokens;
      const inputText =
        typeof cached === "number" && cached > 0
          ? `输入 ${formatTokenCount(inputTokens)}（缓存读 ${formatTokenCount(cached)}）`
          : `输入 ${formatTokenCount(inputTokens)}`;
      parts.push(inputText);
    }
    if (hasOutput) {
      parts.push(`输出 ${formatTokenCount(outputTokens)}`);
    }
    return parts.join(" · ");
  }

  return "模型暂未提供统计数据";
}

/** Latest completed-round prompt tokens from the most recent assistant message with usage. */
export function resolveLatestLastInputTokens(messages: readonly AiChatMessage[]): number | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "assistant") {
      continue;
    }
    const lastInput = message.usage?.lastInputTokens;
    if (typeof lastInput === "number") {
      return lastInput;
    }
    // Legacy persisted messages: fall back to summed inputTokens (best effort).
    const input = message.usage?.inputTokens;
    if (typeof input === "number") {
      return input;
    }
  }
  return null;
}

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }
  if (value >= 10_000) {
    const thousands = value / 1_000;
    return `${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)}k`;
  }
  return String(value);
}

export type ContextUsageRatio = {
  used: number;
  limit: number;
  /** 0–100+ (may exceed 100 if provider reports over limit). */
  percent: number;
  label: string;
  /** Tailwind emphasis when occupancy is high. */
  toneClass: string | null;
};

/**
 * Build context occupancy for composer when the model has a configured window.
 * Returns null when limit is unset or usage is unknown.
 */
export function describeContextUsageRatio(
  contextLength: number | null | undefined,
  lastInputTokens: number | null | undefined,
): ContextUsageRatio | null {
  if (
    typeof contextLength !== "number" ||
    !Number.isFinite(contextLength) ||
    contextLength < 1 ||
    typeof lastInputTokens !== "number" ||
    !Number.isFinite(lastInputTokens) ||
    lastInputTokens < 0
  ) {
    return null;
  }

  const percent = Math.round((lastInputTokens / contextLength) * 100);
  const label = `${formatTokenCount(lastInputTokens)}/${formatTokenCount(contextLength)} · ${percent}%`;
  const toneClass = percent >= 95 ? "text-ctp-red" : percent >= 80 ? "text-ctp-yellow" : null;

  return {
    used: lastInputTokens,
    limit: contextLength,
    percent,
    label,
    toneClass,
  };
}
