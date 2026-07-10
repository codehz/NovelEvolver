import { cn } from "#app/shared/lib/ui/cn";
import type { AiChatAssistantMessage, AiChatToolCall } from "#shared/rpc/ai-rpc";

export const panelSectionClass = cn("mx-auto flex w-full max-w-3xl flex-col");
export const conversationRailClass = cn("gap-4 px-3 py-2.5");
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
);
export const sendButtonClass = cn(
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-badge-background text-badge-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40",
);
export const toolCallPanelClass = cn("flex flex-col gap-1");
export const toolCallToggleClass = cn(
  "flex w-full items-center gap-1.5 text-left text-2xs text-ctp-subtext1 focus-visible:ring-1 focus-visible:ring-badge-background/60 focus-visible:outline-none",
);
export const toolCallToggleActiveClass = cn("rounded-md ring-1 ring-ctp-blue/40");
export const toolCallLabelClass = cn("font-medium tracking-[0.02em] text-ctp-blue");
export const toolCallStatusClass = cn("text-2xs text-ctp-overlay0");
export const toolCallBodyClass = cn(
  "flex flex-col gap-2 text-[0.75rem] leading-5 text-app-muted",
  "[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-app-background [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-2xs",
);
export const toolCallQuestionClass = cn("text-[0.75rem] leading-5 text-app-foreground");

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

export function formatToolArguments(argumentsText: string): string {
  if (argumentsText.trim() === "") {
    return "{}";
  }

  try {
    return JSON.stringify(JSON.parse(argumentsText), null, 2);
  } catch {
    return argumentsText;
  }
}

export function describeAssistantMessageMeta(message: AiChatAssistantMessage): string {
  const parts: string[] = [];

  if (message.status === "streaming") {
    const hasRunningTool = message.parts.some(
      (part) => part.type === "tool_call" && part.status === "running",
    );
    const hasStreamingReasoning = message.parts.some(
      (part) => part.type === "reasoning" && part.status === "streaming",
    );
    parts.push(hasStreamingReasoning ? "思考中" : hasRunningTool ? "执行工具中" : "流式输出中");
  }

  const toolCount = message.parts.filter((part) => part.type === "tool_call").length;
  if (toolCount > 0) {
    parts.push(`工具 ${toolCount}`);
  }

  if (typeof message.usage?.inputTokens === "number") {
    parts.push(`输入 ${message.usage.inputTokens} tok`);
  }
  if (typeof message.usage?.reasoningTokens === "number") {
    parts.push(`思考 ${message.usage.reasoningTokens} tok`);
  }
  if (typeof message.usage?.outputTokens === "number") {
    parts.push(`输出 ${message.usage.outputTokens} tok`);
  }
  if (typeof message.usage?.totalTokens === "number") {
    parts.push(`总计 ${message.usage.totalTokens} tok`);
  }

  return parts.length > 0 ? parts.join(" · ") : "已完成";
}
