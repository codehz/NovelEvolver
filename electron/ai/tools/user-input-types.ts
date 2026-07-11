import type { ToolResultItem } from "@codehz/ai";

import type { UserInputRequestHandle } from "#shared/rpc/ai-rpc";

/**
 * 工具提交用户回答时调用的 resolver。handle 内部构造好 ToolResultItem 后
 * 通过此回调交还给 session；session 据此继续 AI 请求循环。
 */
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
