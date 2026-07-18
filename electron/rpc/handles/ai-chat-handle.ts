import { RpcTarget } from "capnweb";

import type {
  AiChatEvent,
  AiChatHandle,
  AiChatSelectableAgent,
  AiChatSelectableModel,
  AiChatSendMessageInput,
  AiConversationListOptions,
  AiConversationSearchHit,
  AiConversationSearchOptions,
  AiConversationSummary,
} from "#shared/rpc/ai/index";
import type { AiReasoningLevel } from "#shared/rpc/services/index";

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

  sendMessage(input: AiChatSendMessageInput): void {
    this.#chat.sendMessage(input);
  }

  stopGeneration(): void {
    this.#chat.stopGeneration();
  }

  retryLastRequest(): void {
    this.#chat.retryLastRequest();
  }

  forkFromMessage(messageId: string): void {
    this.#chat.forkFromMessage(messageId);
  }

  selectMessageBranch(messageId: string, index: number): void {
    this.#chat.selectMessageBranch(messageId, index);
  }

  editUserMessage(messageId: string, input: AiChatSendMessageInput): void {
    this.#chat.editUserMessage(messageId, input);
  }

  createConversation(): void {
    this.#chat.createConversation();
  }

  listConversations(options?: AiConversationListOptions): AiConversationSummary[] {
    return this.#chat.listConversations(options);
  }

  searchConversations(
    query: string,
    options?: AiConversationSearchOptions,
  ): AiConversationSearchHit[] {
    return this.#chat.searchConversations(query, options);
  }

  switchConversation(conversationId: string): void {
    this.#chat.switchConversation(conversationId);
  }

  renameConversation(conversationId: string, title: string): void {
    this.#chat.renameConversation(conversationId, title);
  }

  archiveConversation(conversationId: string): void {
    this.#chat.archiveConversation(conversationId);
  }

  unarchiveConversation(conversationId: string): void {
    this.#chat.unarchiveConversation(conversationId);
  }

  deleteConversation(conversationId: string): void {
    this.#chat.deleteConversation(conversationId);
  }

  listSelectableModels(): AiChatSelectableModel[] {
    return this.#chat.listSelectableModels();
  }

  setSelectedModel(modelId: string): void {
    this.#chat.setSelectedModel(modelId);
  }

  listSelectableAgents(): AiChatSelectableAgent[] {
    return this.#chat.listSelectableAgents();
  }

  setSelectedAgent(agentId: string): void {
    this.#chat.setSelectedAgent(agentId);
  }

  setSelectedReasoningLevel(level: AiReasoningLevel | null): void {
    this.#chat.setSelectedReasoningLevel(level);
  }
}
