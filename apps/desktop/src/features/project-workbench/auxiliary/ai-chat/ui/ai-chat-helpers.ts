import type {
  AiChatAssistantMessage,
  AiChatMessage,
  AiChatToolCall,
  AiChatWarning,
  AiChatSnapshot,
} from "#shared/rpc/ai/index";

import type { AssistantWorkStep } from "../messages/project-assistant-segments";
import { isWorkSegmentLive } from "../messages/project-assistant-segments";
import { toolActionLabel } from "../tools/presenter-format";
import {
  describeRunningSubagentStatus,
  progressUiFromToolView,
} from "../tools/subagent-progress-ui";

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
      return "准备中";
    case "running":
      return "进行中";
    case "awaiting_user":
      return "等待回答";
    case "complete":
      return "完成";
    case "error":
      return "失败";
  }
}

/**
 * Work segment collapsed summary. Step counts only on done — never durations.
 * Live: status/action only (no N 步 / k/N — meaningless while streaming).
 * Done: 已完成 N 个步骤. Reasoning and tool calls both count as one step.
 */
export function describeWorkSummary(steps: readonly AssistantWorkStep[]): string {
  const total = steps.length;
  if (total === 0) {
    return "无步骤";
  }

  const errorCount = steps.filter(
    (step) => step.type === "tool_call" && step.status === "error",
  ).length;

  if (isWorkSegmentLive(steps)) {
    const streamingReasoning = steps.find(
      (step) => step.type === "reasoning" && step.status === "streaming",
    );
    if (streamingReasoning) {
      return "进行中";
    }

    for (let index = steps.length - 1; index >= 0; index -= 1) {
      const step = steps[index]!;
      if (step.type === "tool_call" && (step.status === "running" || step.status === "pending")) {
        return toolActionLabel(step.name);
      }
    }

    return "进行中";
  }

  if (errorCount > 0) {
    return `已完成 ${total} 个步骤 · ${errorCount} 失败`;
  }
  return `已完成 ${total} 个步骤`;
}

export function findRunningSubagentToolCall(
  message: AiChatAssistantMessage,
): AiChatToolCall | null {
  for (let index = message.parts.length - 1; index >= 0; index -= 1) {
    const part = message.parts[index];
    if (part?.type === "tool_call" && part.name === "run_subagent" && part.status === "running") {
      return part;
    }
  }
  return null;
}

/** Streaming process label for the assistant message footer (left-aligned). */
export function describeAssistantStreamingMeta(message: AiChatAssistantMessage): string {
  const hasStreamingReasoning = message.parts.some(
    (part) => part.type === "reasoning" && part.status === "streaming",
  );
  if (hasStreamingReasoning) {
    return "思考中";
  }

  const runningSubagent = findRunningSubagentToolCall(message);
  if (runningSubagent) {
    const progress = progressUiFromToolView(runningSubagent.view);
    if (progress) {
      return describeRunningSubagentStatus(progress);
    }
    return "子代理执行中";
  }

  const hasRunningTool = message.parts.some(
    (part) => part.type === "tool_call" && part.status === "running",
  );
  return hasRunningTool ? "调用工具中" : "正在工作";
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
