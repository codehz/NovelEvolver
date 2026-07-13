import type { ToolCallItem, ToolResultItem } from "@codehz/ai";
import { toolResultItem } from "@codehz/ai";

import type { ToolExecutionResult, UserInputRequest } from "./types";

export function okJson(call: ToolCallItem, json: unknown): ToolExecutionResult {
  const resultText = JSON.stringify(json, null, 2);
  return {
    toolResult: toolResultItem(call.id, call.name, "success", [{ type: "json", json }]),
    resultText,
    errorMessage: null,
  };
}

export function err(call: ToolCallItem, message: string): ToolExecutionResult {
  return {
    toolResult: toolResultItem(call.id, call.name, "error", [{ type: "text", text: message }]),
    resultText: null,
    errorMessage: message,
  };
}

export function pendingUserInput(
  call: ToolCallItem,
  request: UserInputRequest,
): ToolExecutionResult {
  return {
    toolResult: toolResultItem(call.id, call.name, "rejected", [
      { type: "text", text: "等待用户回答。" },
    ]),
    resultText: null,
    errorMessage: null,
    userInputRequest: request,
  };
}

export function successToolResult(callId: string, toolName: string, json: unknown): ToolResultItem {
  return toolResultItem(callId, toolName, "success", [{ type: "json", json }]);
}

export function rejectedToolResult(callId: string, toolName: string, text: string): ToolResultItem {
  return toolResultItem(callId, toolName, "rejected", [{ type: "text", text }]);
}
