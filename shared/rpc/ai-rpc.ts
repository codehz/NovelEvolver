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
  awaitingUserInputToolCallIds: string[];
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
  awaitingUserInputToolCallIds?: string[];
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
  submitToolResponse(toolCallId: string, text: string): void;
  createConversation(): void;
  listConversations(): AiConversationSummary[];
  switchConversation(conversationId: string): void;
}
