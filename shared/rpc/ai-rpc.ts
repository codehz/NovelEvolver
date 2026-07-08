import type { RpcTarget } from "capnweb";

import type { RpcSubscriptionResult } from "./stream";

export type AiChatMessageUsage = {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
};

export type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  status: "streaming" | "complete";
  usage: AiChatMessageUsage | null;
};

export type AiChatSnapshot = {
  adapterKind: "mock";
  model: string;
  messages: AiChatMessage[];
  pending: boolean;
  errorMessage: string | null;
};

export interface AiChatHandle extends RpcTarget {
  subscribeChat(): RpcSubscriptionResult<AiChatSnapshot>;
  sendMessage(text: string): void;
  resetConversation(): void;
}
