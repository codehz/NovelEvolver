import { RpcTarget } from "capnweb";

import type { AiCatalogHandle } from "#desktop-rpc/ai/handles";
import type { AiChatSelectableAgent, AiChatSelectableModel } from "#domain/ai/chat";

import type { ProjectAiChatController } from "../../ai/chat/project-ai-chat";

export class AiCatalogHandleImpl extends RpcTarget implements AiCatalogHandle {
  readonly #chat: ProjectAiChatController;

  constructor(chat: ProjectAiChatController) {
    super();
    this.#chat = chat;
  }

  listModels(): AiChatSelectableModel[] {
    return this.#chat.listSelectableModels();
  }

  listAgents(): AiChatSelectableAgent[] {
    return this.#chat.listSelectableAgents();
  }
}
