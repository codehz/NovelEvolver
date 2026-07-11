import type { RpcTarget } from "capnweb";

import type { RpcSubscriptionResult } from "./stream";

export type AiChatMessageUsage = {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
};

export type AiChatMessageStatus = "streaming" | "complete";
export type AiChatReasoningVisibility = "full" | "summary" | "redacted" | "opaque";
export type AiChatToolCallStatus = "pending" | "running" | "awaiting_user" | "complete" | "error";

export type AiChatMessagePart = {
  id: string;
  type: "message";
  text: string;
  status: AiChatMessageStatus;
};

export type AiChatReasoningPart = {
  id: string;
  type: "reasoning";
  text: string;
  visibility: AiChatReasoningVisibility;
  status: AiChatMessageStatus;
};

export type AiChatToolCall = {
  id: string;
  type: "tool_call";
  name: string;
  argumentsText: string;
  status: AiChatToolCallStatus;
  resultText: string | null;
  errorMessage: string | null;
};

export type AskUserChoice = {
  title: string;
  description?: string;
};

/**
 * 用户输入请求 handle：仅暴露回传方法。
 *
 * Cap'n Web 的 `RpcTarget` 按引用传递，客户端拿到的是 stub；属性读取是异步
 * `RpcPromise`，不能当作同步字段做 UI 分派。展示数据放在旁路纯 DTO
 *（`AiChatPendingUserInput`）里随 snapshot/delta 按值推送。
 */
export interface UserInputRequestHandle extends RpcTarget {
  /** 提交回答；幂等：重复调用会被忽略。 */
  submitAnswer(text: string): void;
  /** 取消回答，工具将以 rejected 结果返回给 AI。 */
  cancel(): void;
}

/**
 * `ask_user` 工具的 typed handle：期望一段文本回答。
 */
export interface AskUserRequestHandle extends UserInputRequestHandle {}

/**
 * 需要用户回答的请求视图（按值）+ 提交 handle（按引用）。
 * 客户端按 `kind` 分派 UI，只读 DTO 字段；回传调用 `handle` 方法。
 */
export type AskUserPendingInput = {
  kind: "ask_user";
  toolName: "ask_user";
  /** 展示用简短提示（如问题标题）。 */
  prompt: string;
  question: string;
  context: string | null;
  placeholder: string | null;
  choices: AskUserChoice[] | null;
  handle: AskUserRequestHandle;
};

/** 当前所有可能的用户输入请求联合类型。 */
export type AiChatPendingUserInput = AskUserPendingInput;

export type AiChatAssistantPart = AiChatMessagePart | AiChatReasoningPart | AiChatToolCall;

export type AiChatAssistantPartPatch = {
  text?: string;
  visibility?: AiChatReasoningVisibility;
  status?: AiChatMessageStatus | AiChatToolCallStatus;
  argumentsText?: string;
  resultText?: string | null;
  errorMessage?: string | null;
};

export type AiChatUserMessage = {
  id: string;
  role: "user";
  text: string;
  status: "complete";
};

export type AiChatAssistantMessage = {
  id: string;
  role: "assistant";
  status: AiChatMessageStatus;
  usage: AiChatMessageUsage | null;
  parts: AiChatAssistantPart[];
};

export type AiChatMessage = AiChatUserMessage | AiChatAssistantMessage;

export type AiChatSnapshot = {
  conversationId: string;
  adapterKind: "mock";
  model: string;
  messages: AiChatMessage[];
  pending: boolean;
  pendingUserInputs: AiChatPendingUserInput[];
  errorMessage: string | null;
};

export type AiConversationActivity = "idle" | "streaming" | "awaiting_user";

export type AiConversationSummary = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  lastActiveAt: number;
  activity: AiConversationActivity;
  persisted: boolean;
};

export type AiChatMessagePatch = {
  status?: AiChatMessageStatus;
  usage?: AiChatMessageUsage | null;
};

export type AiChatStatePatch = {
  pending?: boolean;
  pendingUserInputs?: AiChatPendingUserInput[];
  errorMessage?: string | null;
};

export type AiChatDeltaOp =
  | {
      type: "conversation.reset";
    }
  | {
      type: "message.added";
      message: AiChatMessage;
    }
  | {
      type: "message.updated";
      messageId: string;
      patch: AiChatMessagePatch;
    }
  | {
      type: "message.removed";
      messageId: string;
    }
  | {
      type: "assistant_part.added";
      messageId: string;
      part: AiChatAssistantPart;
    }
  | {
      type: "assistant_part.text.delta";
      messageId: string;
      partId: string;
      text: string;
    }
  | {
      type: "assistant_part.updated";
      messageId: string;
      partId: string;
      patch: AiChatAssistantPartPatch;
    }
  | {
      type: "state.updated";
      patch: AiChatStatePatch;
    };

export type AiChatSnapshotEvent = {
  kind: "snapshot";
  snapshot: AiChatSnapshot;
};

export type AiChatDeltaEvent = {
  kind: "delta";
  ops: AiChatDeltaOp[];
};

export type AiChatEvent = AiChatSnapshotEvent | AiChatDeltaEvent;

export interface AiChatHandle extends RpcTarget {
  subscribeChat(): RpcSubscriptionResult<AiChatEvent>;
  sendMessage(text: string): void;
  createConversation(): void;
  listConversations(): AiConversationSummary[];
  switchConversation(conversationId: string): void;
}
