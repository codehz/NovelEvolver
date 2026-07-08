import { RpcTarget } from "capnweb";

import type { AiChatHandle, AiChatSnapshot } from "#shared/rpc/ai-rpc";

import type { BranchAiSession } from "../../ai/branch-ai-session";

export class AiChatHandleImpl extends RpcTarget implements AiChatHandle {
  readonly #session: BranchAiSession;

  constructor(session: BranchAiSession) {
    super();
    this.#session = session;
  }

  async subscribeChat(): Promise<ReadableStream<AiChatSnapshot>> {
    return this.#session.subscribe();
  }

  sendMessage(text: string): void {
    this.#session.sendMessage(text);
  }

  resetConversation(): void {
    this.#session.resetConversation();
  }
}
