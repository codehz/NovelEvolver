import { cn } from "#app/shared/lib/ui/cn";
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

export const panelSectionClass = cn("mx-auto flex w-full max-w-3xl flex-col");
export const conversationRailClass = cn("gap-4 px-3 py-2.5 select-text");
export const assistantMessageBlockClass = cn("flex w-full flex-col gap-1");
export const assistantMessageBodyClass = cn(
  "text-[0.8125rem] leading-5 text-app-foreground",
  "[&_a]:text-ctp-blue [&_a]:underline [&_a]:underline-offset-2",
  "[&_code]:rounded-md [&_code]:bg-window-chrome [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.75rem]",
  "**:data-[streamdown='blockquote']:border-ctp-blue/40 **:data-[streamdown='blockquote']:text-app-muted",
  "**:data-[streamdown='code-block']:border-titlebar-border **:data-[streamdown='code-block']:bg-app-surface",
  "**:data-[streamdown='code-block-actions']:border-titlebar-border **:data-[streamdown='code-block-actions']:bg-app-surface/80",
  "**:data-[streamdown='code-block-body']:border-titlebar-border **:data-[streamdown='code-block-body']:bg-window-chrome",
  "**:data-[streamdown='heading-1']:text-base",
  "**:data-[streamdown='heading-1']:text-ctp-mauve **:data-[streamdown='heading-2']:text-ctp-mauve **:data-[streamdown='heading-3']:text-ctp-mauve",
  "**:data-[streamdown='inline-code']:text-ctp-green",
);
export const reasoningPanelClass = cn("flex flex-col gap-1");
export const reasoningToggleClass = cn(
  "flex w-full items-center gap-1.5 text-left text-2xs text-ctp-subtext1 focus-visible:ring-1 focus-visible:ring-badge-background/60 focus-visible:outline-none",
);
export const reasoningLabelClass = cn("font-medium tracking-[0.02em] text-ctp-mauve");
export const reasoningMetaClass = cn(
  "overflow-hidden text-2xs text-ellipsis whitespace-nowrap text-ctp-subtext1 tabular-nums",
);
export const reasoningBodyClass = cn(
  "text-[0.75rem] leading-5 text-app-muted",
  "[&_code]:rounded-md [&_code]:bg-app-background [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono",
  "**:data-[streamdown='blockquote']:border-ctp-blue/30 **:data-[streamdown='blockquote']:text-ctp-subtext0",
  "**:data-[streamdown='code-block']:border-titlebar-border **:data-[streamdown='code-block']:bg-app-surface/80",
  "**:data-[streamdown='code-block-actions']:border-titlebar-border **:data-[streamdown='code-block-actions']:bg-app-surface/70",
  "**:data-[streamdown='code-block-body']:border-titlebar-border **:data-[streamdown='code-block-body']:bg-app-background",
  "**:data-[streamdown='heading-1']:text-sm **:data-[streamdown='heading-2']:text-sm **:data-[streamdown='heading-3']:text-sm",
);
export const userMessageRowClass = cn("flex justify-end");
export const userMessageBubbleClass = cn(
  "max-w-[88%] rounded-xl bg-window-chrome px-3 py-2 text-[0.8125rem] leading-5 text-app-foreground shadow-[inset_0_1px_0_0_color-mix(in_srgb,var(--color-ctp-surface0)_24%,transparent)]",
);
export const composerShellClass = cn(
  "mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-xl bg-app-background p-2",
);
export const composerTextareaClass = cn(
  "field-sizing-content min-h-24 w-full resize-none border-0 bg-transparent p-1 text-[0.8125rem] leading-5 text-app-foreground outline-none placeholder:text-ctp-overlay0",
  "max-h-[50vh]",
);
export const sendButtonClass = cn(
  "inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-badge-background text-badge-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40",
);
export const modelSelectorButtonClass = cn(
  "inline-flex h-6 min-w-0 items-center gap-1 rounded-md px-1.5 text-2xs text-ctp-subtext1",
  "hover:bg-window-chrome hover:text-app-foreground",
  "focus-visible:ring-1 focus-visible:ring-badge-background/60 focus-visible:outline-none",
  "disabled:cursor-not-allowed disabled:opacity-40",
);
export const agentSelectorButtonClass = cn(
  "inline-flex h-6 min-w-0 items-center gap-1 rounded-md px-1.5 text-2xs text-ctp-subtext1",
  "hover:bg-window-chrome hover:text-app-foreground",
  "focus-visible:ring-1 focus-visible:ring-badge-background/60 focus-visible:outline-none",
  "disabled:cursor-not-allowed disabled:opacity-40",
);
export const modelSelectorLabelClass = cn("min-w-0 truncate font-medium");
export const toolCallPanelClass = cn("flex flex-col gap-1");
export const toolCallToggleClass = cn(
  "grid w-full grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-1.5 text-left text-2xs text-ctp-subtext1 focus-visible:ring-1 focus-visible:ring-badge-background/60 focus-visible:outline-none",
);
export const toolCallToggleActiveClass = cn("rounded-md ring-1 ring-ctp-blue/40");
export const toolCallLabelClass = cn(
  "font-medium tracking-[0.02em] whitespace-nowrap text-ctp-blue",
);
export const toolCallStatusClass = cn("text-2xs whitespace-nowrap text-ctp-overlay0");
export const toolCallBodyClass = cn("flex flex-col gap-2 text-[0.75rem] leading-5 text-app-muted");
export const toolCallQuestionClass = cn("text-[0.75rem] leading-5 text-app-foreground");
export const warningBannerClass = cn(
  "rounded-md border border-ctp-yellow/40 bg-ctp-yellow/10 px-3 py-2 text-xs break-all whitespace-pre-wrap text-ctp-yellow select-text",
);

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

export function describeAssistantMessageMeta(message: AiChatAssistantMessage): string {
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

  if (message.status === "streaming") {
    const hasRunningTool = message.parts.some(
      (part) => part.type === "tool_call" && part.status === "running",
    );
    const hasStreamingReasoning = message.parts.some(
      (part) => part.type === "reasoning" && part.status === "streaming",
    );
    return hasStreamingReasoning ? "思考中" : hasRunningTool ? "执行工具中" : "流式输出中";
  }

  return "";
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
