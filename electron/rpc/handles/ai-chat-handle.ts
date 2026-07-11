import { RpcTarget } from "capnweb";

import type { AiChatEvent, AiChatHandle, AiConversationSummary } from "#shared/rpc/ai-rpc";

import type { ProjectAiChatController } from "../../ai/chat/project-ai-chat";

export class AiChatHandleImpl extends RpcTarget implements AiChatHandle {
  readonly #chat: ProjectAiChatController;

  constructor(chat: ProjectAiChatController) {
    super();
    this.#chat = chat;
  }

  async subscribeChat(): Promise<ReadableStream<AiChatEvent>> {
    return this.#chat.subscribe();
  }

  sendMessage(text: string): void {
    this.#chat.sendMessage(text);
  }

  createConversation(): void {
    this.#chat.createConversation();
  }

  listConversations(): AiConversationSummary[] {
    return this.#chat.listConversations();
  }

  switchConversation(conversationId: string): void {
    this.#chat.switchConversation(conversationId);
  }
}
