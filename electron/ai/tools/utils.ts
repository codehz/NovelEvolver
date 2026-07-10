import type { ToolCallItem } from "@codehz/ai";

/**
 * 从 ToolCallItem 中解析参数对象，优先使用已解析的 argumentsJson。
 * 所有工具执行函数共享此实现，避免重复。
 */
export function parseToolArgs(call: ToolCallItem): Record<string, unknown> {
  if (
    call.argumentsJson !== undefined &&
    typeof call.argumentsJson === "object" &&
    call.argumentsJson !== null
  ) {
    return call.argumentsJson as Record<string, unknown>;
  }

  const argumentsText = call.argumentsText.trim();
  if (argumentsText === "") {
    return {};
  }

  return JSON.parse(argumentsText) as Record<string, unknown>;
}
