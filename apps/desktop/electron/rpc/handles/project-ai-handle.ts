import type { ProjectAiChatController } from "@novelevolver/ai-runtime";
import type {
  AiActiveChatHandle,
  AiCatalogHandle,
  AiConversationsHandle,
  ProjectAi,
} from "@novelevolver/desktop-rpc/ai/handles";
import { RpcTarget } from "capnweb";

import { AiActiveChatHandleImpl } from "./ai-active-chat-handle";
import { AiCatalogHandleImpl } from "./ai-catalog-handle";
import { AiConversationsHandleImpl } from "./ai-conversations-handle";

export class ProjectAiHandleImpl extends RpcTarget implements ProjectAi {
  readonly #active: AiActiveChatHandle;
  readonly #conversations: AiConversationsHandle;
  readonly #catalog: AiCatalogHandle;

  constructor(chat: ProjectAiChatController) {
    super();
    this.#active = new AiActiveChatHandleImpl(chat);
    this.#conversations = new AiConversationsHandleImpl(chat);
    this.#catalog = new AiCatalogHandleImpl(chat);
  }

  get active(): AiActiveChatHandle {
    return this.#active;
  }

  get conversations(): AiConversationsHandle {
    return this.#conversations;
  }

  get catalog(): AiCatalogHandle {
    return this.#catalog;
  }
}
