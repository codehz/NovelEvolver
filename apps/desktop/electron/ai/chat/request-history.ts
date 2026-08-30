import type { InputItem } from "@codehz/ai";

import type { AiChatAssistantPart } from "#domain/ai";

/**
 * 去掉 history 末尾连续的模型产物，停在 user message 或 tool_result。
 * 结果即「上一次 model request」的 input，与 send 使用的 history 前缀语义一致。
 * 用于继续会话 / abort 落盘（保留已提交 tool 轮次）。
 */
export function rebuildLastRequestInput(history: readonly InputItem[]): InputItem[] {
  let end = history.length;
  while (end > 0) {
    const item = history[end - 1]!;
    if (item.type === "tool_result") {
      break;
    }
    if (item.type === "message" && item.role === "user") {
      break;
    }
    end -= 1;
  }
  return history.slice(0, end);
}

/**
 * 去掉 history 末尾直到（并保留）最后一个 user message。
 * **不**在 tool_result 处停下——用于 sibling 重试，避免复用本轮 tool 上下文。
 */
export function rebuildFromLastUserMessage(history: readonly InputItem[]): InputItem[] {
  let end = history.length;
  while (end > 0) {
    const item = history[end - 1]!;
    if (item.type === "message" && item.role === "user") {
      break;
    }
    end -= 1;
  }
  return history.slice(0, end);
}

/**
 * 根据已提交的 history（request 边界）计算 assistant parts 应保留的前缀长度。
 * 仅保留「工具结果已写入 history」的完整 tool 轮次；最后一次未提交的模型输出整段丢弃。
 */
export function countCommittedAssistantParts(
  parts: readonly AiChatAssistantPart[],
  history: readonly InputItem[],
): number {
  const resolvedCallIds = new Set<string>();
  for (const item of history) {
    if (item.type === "tool_result") {
      resolvedCallIds.add(item.callId);
    }
  }

  let committedEnd = 0;
  let index = 0;
  while (index < parts.length) {
    while (index < parts.length && parts[index]!.type !== "tool_call") {
      index += 1;
    }
    const toolStart = index;
    while (index < parts.length && parts[index]!.type === "tool_call") {
      index += 1;
    }
    const tools = parts.slice(toolStart, index);
    if (tools.length === 0) {
      break;
    }
    if (tools.every((part) => part.type === "tool_call" && resolvedCallIds.has(part.id))) {
      committedEnd = index;
      continue;
    }
    break;
  }
  return committedEnd;
}
