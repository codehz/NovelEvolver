import type { AiActiveChatHandle } from "@novelevolver/desktop-rpc/ai/handles";
import type {
  AiChatEvent,
  AiChatInteractionAnswer,
  AiChatSendMessageInput,
} from "@novelevolver/domain/ai/chat";
import type { AiReasoningLevel } from "@novelevolver/domain/settings/ai-settings";
import { RpcTarget } from "capnweb";

import type { ProjectAiChatController } from "../../ai/chat/project-ai-chat";

export class AiActiveChatHandleImpl extends RpcTarget implements AiActiveChatHandle {
  readonly #chat: ProjectAiChatController;

  constructor(chat: ProjectAiChatController) {
    super();
    this.#chat = chat;
  }

  async subscribe(): Promise<ReadableStream<AiChatEvent>> {
    return this.#chat.subscribe();
  }

  sendMessage(input: AiChatSendMessageInput): void {
    this.#chat.sendMessage(input);
  }

  stopGeneration(): void {
    this.#chat.stopGeneration();
  }

  submitInteraction(id: string, answer: AiChatInteractionAnswer): void {
    this.#chat.submitInteraction(id, answer);
  }

  cancelInteraction(id: string): void {
    this.#chat.cancelInteraction(id);
  }

  retryLastRequest(): void {
    this.#chat.retryLastRequest();
  }

  continueLastRequest(): void {
    this.#chat.continueLastRequest();
  }

  selectMessageBranch(messageId: string, index: number): void {
    this.#chat.selectMessageBranch(messageId, index);
  }

  editUserMessage(messageId: string, input: AiChatSendMessageInput): void {
    this.#chat.editUserMessage(messageId, input);
  }

  setSelectedModel(modelId: string): void {
    this.#chat.setSelectedModel(modelId);
  }

  setSelectedAgent(agentId: string): void {
    this.#chat.setSelectedAgent(agentId);
  }

  setSelectedReasoningLevel(level: AiReasoningLevel | null): void {
    this.#chat.setSelectedReasoningLevel(level);
  }
}
