import type { ProjectAiChatController } from "@novelevolver/ai-runtime";
import type { AiConversationsHandle } from "@novelevolver/desktop-rpc/ai/handles";
import type {
  AiConversationDirectoryEvent,
  AiConversationSearchHit,
  AiConversationSearchOptions,
} from "@novelevolver/domain/ai/chat";
import { RpcTarget } from "capnweb";

export class AiConversationsHandleImpl extends RpcTarget implements AiConversationsHandle {
  readonly #chat: ProjectAiChatController;

  constructor(chat: ProjectAiChatController) {
    super();
    this.#chat = chat;
  }

  async subscribe(): Promise<ReadableStream<AiConversationDirectoryEvent>> {
    return this.#chat.subscribeDirectory();
  }

  search(query: string, options?: AiConversationSearchOptions): AiConversationSearchHit[] {
    return this.#chat.searchConversations(query, options);
  }

  create(): void {
    this.#chat.createConversation();
  }

  switch(conversationId: string): void {
    this.#chat.switchConversation(conversationId);
  }

  rename(conversationId: string, title: string): void {
    this.#chat.renameConversation(conversationId, title);
  }

  archive(conversationId: string): void {
    this.#chat.archiveConversation(conversationId);
  }

  unarchive(conversationId: string): void {
    this.#chat.unarchiveConversation(conversationId);
  }

  delete(conversationId: string): void {
    this.#chat.deleteConversation(conversationId);
  }
}
