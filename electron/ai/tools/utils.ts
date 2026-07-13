import type { ToolCallItem } from "@codehz/ai";

export function parseToolArgs(call: ToolCallItem): Record<string, unknown> {
  const argumentsText = call.argumentsText.trim();
  if (argumentsText === "") {
    return {};
  }

  const parsed: unknown = JSON.parse(argumentsText);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("工具参数必须是 JSON 对象。");
  }
  return parsed as Record<string, unknown>;
}
