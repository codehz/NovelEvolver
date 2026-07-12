import type { AIResponse, ContentBlock } from "@codehz/ai";

import type { AiChatMessageUsage, AiChatReasoningPart } from "#shared/rpc/ai/index";

/**
 * 从 AIResponse 的 output 中提取纯文本内容。
 */
export function readResponseText(response: AIResponse): string {
  return response.output
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content)
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

/**
 * 将任意错误对象转换为可读的字符串消息。
 */
export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 将 AIResponse 的 usage 映射为前端使用的 AiChatMessageUsage。
 * 字段缺失时返回 null。
 */
export function toMessageUsage(usage: AIResponse["usage"]): AiChatMessageUsage | null {
  if (!usage) {
    return null;
  }

  const messageUsage: AiChatMessageUsage = {};

  if (typeof usage.inputTokens === "number") {
    messageUsage.inputTokens = usage.inputTokens;
  }
  if (typeof usage.outputTokens === "number") {
    messageUsage.outputTokens = usage.outputTokens;
  }
  if (typeof usage.reasoningTokens === "number") {
    messageUsage.reasoningTokens = usage.reasoningTokens;
  }
  if (typeof usage.totalTokens === "number") {
    messageUsage.totalTokens = usage.totalTokens;
  } else if (
    typeof messageUsage.inputTokens === "number" &&
    typeof messageUsage.outputTokens === "number"
  ) {
    messageUsage.totalTokens = messageUsage.inputTokens + messageUsage.outputTokens;
  }

  return Object.keys(messageUsage).length > 0 ? messageUsage : null;
}

export function addMessageUsage(
  current: AiChatMessageUsage | null,
  usage: AIResponse["usage"],
): AiChatMessageUsage | null {
  const next = toMessageUsage(usage);
  if (!next) {
    return current;
  }
  if (!current) {
    return next;
  }

  const combined: AiChatMessageUsage = {};
  for (const field of ["inputTokens", "outputTokens", "reasoningTokens", "totalTokens"] as const) {
    const currentValue = current[field];
    const nextValue = next[field];
    if (typeof currentValue === "number" || typeof nextValue === "number") {
      combined[field] = (currentValue ?? 0) + (nextValue ?? 0);
    }
  }
  return combined;
}

export function contentBlockToDisplayText(block: ContentBlock): string {
  switch (block.type) {
    case "text":
      return block.text;
    case "json":
      return JSON.stringify(block.json, null, 2);
    case "image":
      return `[图片] ${block.imageUrl}`;
    case "binary_ref":
      return `[二进制引用] ${block.ref}`;
    case "opaque":
      return "[私有内容]";
  }
}

export function joinContentBlocksText(content: readonly ContentBlock[]): string {
  return content
    .map(contentBlockToDisplayText)
    .filter((part) => part !== "")
    .join("\n\n");
}

/**
 * 从 AIResponse 的 output 中提取 reasoning 文本与可见性。
 */
export function readResponseReasoning(
  response: AIResponse,
): Pick<AiChatReasoningPart, "text" | "visibility"> | null {
  const reasoningItems = response.output.filter((item) => item.type === "reasoning");
  if (reasoningItems.length === 0) {
    return null;
  }

  const text = joinContentBlocksText(reasoningItems.flatMap((item) => item.content));
  const visibility = reasoningItems.at(-1)?.visibility ?? "summary";

  return text === "" ? null : { text, visibility };
}
