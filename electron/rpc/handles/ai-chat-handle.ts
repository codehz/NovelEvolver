import { RpcTarget } from "capnweb";

import type {
  AiChatEvent,
  AiChatHandle,
  AiChatSelectableAgent,
  AiChatSelectableModel,
  AiConversationSummary,
} from "#shared/rpc/ai/index";

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

  stopGeneration(): void {
    this.#chat.stopGeneration();
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
}
