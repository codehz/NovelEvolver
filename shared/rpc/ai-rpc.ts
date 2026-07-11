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
 * 用户输入请求 handle 基接口。
 *
 * 每个需要用户回答的工具调用会生成一个类型化的 handle，随快照/增量流推给客户端。
 * 客户端持有活对象，按 `kind` 分派 UI，直接调用方法提交回答 —— 无须知道内部 toolCallId，
 * 也无须固定响应类型。新增工具只需新增一个子接口与 `kind`。
 */
export interface UserInputRequestHandle extends RpcTarget {
  /** 判别字段，客户端据此分派 UI 组件。 */
  readonly kind: string;
  readonly toolName: string;
  /** 展示给用户的简短提示（如问题标题）。 */
  readonly prompt: string;
}

/**
 * `ask_user` 工具的 typed handle：期望一段文本回答。
 */
export interface AskUserRequestHandle extends UserInputRequestHandle {
  readonly kind: "ask_user";
  readonly question: string;
  readonly context: string | null;
  readonly placeholder: string | null;
  readonly choices: AskUserChoice[] | null;
  /** 提交回答；幂等：重复调用会被忽略。 */
  submitAnswer(text: string): void;
  /** 取消回答，工具将以 rejected 结果返回给 AI。 */
  cancel(): void;
}

/** 当前所有可能的用户输入请求 handle 联合类型。 */
export type AiChatUserInputHandle = AskUserRequestHandle;

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
  pendingUserInputs: AiChatUserInputHandle[];
  errorMessage: string | null;
};

export type AiConversationSummary = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  lastActiveAt: number;
};

export type AiChatMessagePatch = {
  status?: AiChatMessageStatus;
  usage?: AiChatMessageUsage | null;
};

export type AiChatStatePatch = {
  pending?: boolean;
  pendingUserInputs?: AiChatUserInputHandle[];
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
