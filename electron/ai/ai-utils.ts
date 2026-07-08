import type { AIResponse, ContentBlock } from "@codehz/ai";

import type { AiChatMessage, AiChatMessageUsage, AiChatReasoning } from "#shared/rpc/ai-rpc";

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

function contentBlockToDisplayText(block: ContentBlock): string {
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

/**
 * 从 AIResponse 的 output 中提取 reasoning 文本与可见性。
 */
export function readResponseReasoning(
  response: AIResponse,
): Pick<AiChatReasoning, "text" | "visibility"> | null {
  const reasoningItems = response.output.filter((item) => item.type === "reasoning");
  if (reasoningItems.length === 0) {
    return null;
  }

  const text = reasoningItems
    .flatMap((item) => item.content)
    .map(contentBlockToDisplayText)
    .filter((part) => part !== "")
    .join("\n\n");
  const visibility = reasoningItems.at(-1)?.visibility ?? "summary";

  return text === "" ? null : { text, visibility };
}

/**
 * 浅拷贝一条聊天消息（含 usage 的浅拷贝），用于快照输出。
 */
export function cloneMessage(message: AiChatMessage): AiChatMessage {
  return {
    ...message,
    usage: message.usage ? { ...message.usage } : null,
    reasoning: message.reasoning ? { ...message.reasoning } : null,
  };
}
