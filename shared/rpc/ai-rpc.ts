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

export type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  status: "streaming" | "complete";
  usage: AiChatMessageUsage | null;
  reasoning: AiChatReasoning | null;
};

export type AiChatSnapshot = {
  adapterKind: "mock";
  model: string;
  messages: AiChatMessage[];
  pending: boolean;
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
  resetConversation(): void;
}
