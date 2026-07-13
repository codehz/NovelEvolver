import type { ToolCallItem, ToolDefinition, ToolResultItem } from "@codehz/ai";

import type { AiChatPendingUserInput, UserInputRequestHandle } from "#shared/rpc/ai/index";

import type { WorktreeSession } from "../../worktree/session";

export type ResolveWorktree = () => WorktreeSession;

export type ToolContext = {
  worktree: WorktreeSession;
  call: ToolCallItem;
};

export type UserInputResolver = {
  resolve(result: ToolResultItem): void;
};

/**
 * 工具请求用户输入的描述。
 *
 * `createHandle` 由 session 在绑定 resolver 后调用，产出仅含回传方法的
 * 瘦 handle；展示数据由 session 根据 `serializable` 组装成
 * `AiChatPendingUserInput` DTO。`serializable` 同时用于持久化与重开重建。
 */
export type UserInputRequest = {
  /** 发起该请求的工具名。 */
  toolName: string;
  /** 展示给用户的简短提示（如问题标题）。 */
  prompt: string;
  /** 绑定 resolver 后构造瘦 handle（仅 submit/cancel）。 */
  createHandle(resolver: UserInputResolver): UserInputRequestHandle;
  /** 纯数据形式，用于 DTO 组装、持久化与重开 app 后重建 handle。 */
  serializable: { toolName: string; args: unknown };
};

export type ToolExecutionResult = {
  toolResult: ToolResultItem;
  resultText: string | null;
  errorMessage: string | null;
  userInputRequest?: UserInputRequest;
};

export type PendingUserInputSerializable = {
  toolName: string;
  args: unknown;
};

export type UserInputContribution = {
  createFromSerializable(
    callId: string,
    serializable: PendingUserInputSerializable,
    resolver: UserInputResolver,
  ): AiChatPendingUserInput;
  createFromRequest(
    request: UserInputRequest,
    handle: UserInputRequestHandle,
  ): AiChatPendingUserInput;
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
    typeof candidate.createHandle === "function" &&
    typeof candidate.serializable === "object" &&
    candidate.serializable !== null
  );
}
