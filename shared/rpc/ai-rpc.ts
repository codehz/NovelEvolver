import type { RpcTarget } from "capnweb";

import type { RpcSubscriptionResult } from "./stream";

export type AiChatMessageUsage = {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
};

export type AiChatReasoningVisibility = "full" | "summary" | "redacted" | "opaque";

export type AiChatReasoning = {
  text: string;
  visibility: AiChatReasoningVisibility;
  status: "streaming" | "complete";
};

export type AiChatToolCallStatus = "pending" | "running" | "awaiting_user" | "complete" | "error";

export type AiChatToolCall = {
  id: string;
  name: string;
  argumentsText: string;
  status: AiChatToolCallStatus;
  resultText: string | null;
  errorMessage: string | null;
};

export type AiChatToolCallPatch = {
  argumentsText?: string;
  status?: AiChatToolCallStatus;
  resultText?: string | null;
  errorMessage?: string | null;
};

export type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  status: "streaming" | "complete";
  usage: AiChatMessageUsage | null;
  reasoning: AiChatReasoning | null;
  toolCalls: AiChatToolCall[];
};

export type AiChatSnapshot = {
  adapterKind: "mock";
  model: string;
  messages: AiChatMessage[];
  pending: boolean;
  awaitingAskUserToolCallIds: string[];
  errorMessage: string | null;
};

export type AiChatMessagePatch = {
  text?: string;
  status?: AiChatMessage["status"];
  usage?: AiChatMessage["usage"];
  reasoning?: AiChatReasoningPatch | null;
};

export type AiChatReasoningPatch = {
  text?: string;
  visibility?: AiChatReasoning["visibility"];
  status?: AiChatReasoning["status"];
};

export type AiChatStatePatch = {
  pending?: boolean;
  awaitingAskUserToolCallIds?: string[];
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
      type: "message.text.delta";
      messageId: string;
      text: string;
    }
  | {
      type: "message.reasoning.delta";
      messageId: string;
      text: string;
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
      type: "tool_call.added";
      messageId: string;
      toolCall: AiChatToolCall;
    }
  | {
      type: "tool_call.updated";
      messageId: string;
      toolCallId: string;
      patch: AiChatToolCallPatch;
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
  resetConversation(): void;
}
