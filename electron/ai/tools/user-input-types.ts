import type { ToolResultItem } from "@codehz/ai";

import type { AiChatUserInputHandle } from "#shared/rpc/ai-rpc";

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
 * `createHandle` 由 session 在绑定 resolver 后调用，产出可随 RPC 流传递的
 * 类型化 handle；`serializable` 是纯数据形式，用于持久化与重开 app 后重建 handle。
 */
export type UserInputRequest = {
  /** 发起该请求的工具名，供前端按 toolName 分派 UI 组件。 */
  toolName: string;
  /** 展示给用户的简短提示（如问题标题）。 */
  prompt: string;
  /** 绑定 resolver 后构造类型化 handle，随快照/增量流推给客户端。 */
  createHandle(resolver: UserInputResolver): AiChatUserInputHandle;
  /** 纯数据形式，用于持久化与重开 app 后重建 handle。 */
  serializable: { toolName: string; args: unknown };
};
