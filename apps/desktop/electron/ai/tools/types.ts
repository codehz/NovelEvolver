import type { ToolCallItem, ToolDefinition, ToolResultItem } from "@codehz/ai";

import type {
  AiChatInteractionAnswer,
  AiChatOpenInteraction,
  AiToolView,
} from "#shared/rpc/ai/index";

import type { WorktreeSession } from "../../worktree/session";

export type ResolveWorktree = () => WorktreeSession;

export type ToolContext = {
  worktree: WorktreeSession;
  call: ToolCallItem;
};

export type PendingUserInputSerializable = {
  toolName: string;
  args: unknown;
};

/**
 * 工具请求用户输入的描述（主进程内部）。
 *
 * 展示数据经 contribution 组装为纯 DTO `AiChatOpenInteraction`；
 * 回传经 `AiActiveChatHandle.submitInteraction` / `cancelInteraction`，
 * 再由 contribution 映射为 `ToolResultItem`。
 */
export type UserInputRequest = {
  /** 发起该请求的工具名。 */
  toolName: string;
  /** 展示给用户的简短提示（如问题标题）。 */
  prompt: string;
  /** 纯数据形式，用于 DTO 组装、持久化与重开重建。 */
  serializable: PendingUserInputSerializable;
};

export type ToolExecutionResult = {
  toolResult: ToolResultItem;
  resultText: string | null;
  errorMessage: string | null;
  /** UI projection; null when no custom card is available. */
  view: AiToolView | null;
  userInputRequest?: UserInputRequest;
};

export type UserInputContribution = {
  createOpenInteraction(
    id: string,
    serializable: PendingUserInputSerializable,
  ): AiChatOpenInteraction;
  /**
   * 将客户端 answer 映射为 tool result；kind 不匹配返回 null。
   */
  resolveAnswer(id: string, answer: AiChatInteractionAnswer): ToolResultItem | null;
  /** 用户取消。 */
  resolveCancel(id: string): ToolResultItem;
};

/**
 * Tool 单元：definition + 执行（+ 可选 user-input 贡献）。
 * `run` 失败时抛错；成功返回 JSON 可序列化数据，或 `UserInputRequest` 暂停等待用户
 * （用 `isUserInputRequest` 识别）。
 */
export type ToolSpec<Name extends string = string> = {
  name: Name;
  definition: Omit<ToolDefinition, "name"> & { description: string };
  run(ctx: ToolContext): unknown;
  userInput?: UserInputContribution;
};

export type ToolRunner = {
  execute(call: ToolCallItem): Promise<ToolExecutionResult>;
};

export function isUserInputRequest(value: unknown): value is UserInputRequest {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as UserInputRequest;
  return (
    typeof candidate.toolName === "string" &&
    typeof candidate.prompt === "string" &&
    typeof candidate.serializable === "object" &&
    candidate.serializable !== null
  );
}
