import type { AIClient, AIResponse, AIStreamEvent, InputItem } from "@codehz/ai";

import type {
  AiChatDeltaOp,
  AiChatEvent,
  AiChatMessage,
  AiChatMessagePatch,
  AiChatSnapshot,
} from "#shared/rpc/ai-rpc";

import { RpcStreamPublisher } from "../lib/stream-publisher";
import { cloneMessage, readResponseText, toErrorMessage, toMessageUsage } from "./ai-utils";
import {
  AI_ADAPTER_KIND,
  AI_INSTRUCTIONS,
  AI_MODEL,
  createMockClient,
  toInputItem,
} from "./mock-adapter";

export class BranchAiSession {
  readonly #client: AIClient;
  readonly #publisher = new RpcStreamPublisher<AiChatEvent>();
  readonly #messages: AiChatMessage[] = [];
  readonly #history: InputItem[] = [];
  readonly #providerMessageIds = new Map<string, string>();
  #pending = false;
  #errorMessage: string | null = null;
  #messageCounter = 0;

  constructor(branchName: string) {
    this.#client = createMockClient(branchName);
  }

  subscribe(): ReadableStream<AiChatEvent> {
    return this.#publisher.subscribe({
      getInitialValue: () => ({
        kind: "snapshot",
        snapshot: this.#createSnapshot(),
      }),
    });
  }

  sendMessage(text: string): void {
    const normalized = text.trim();
    if (normalized === "") {
      throw new Error("AI 消息不能为空。");
    }
    if (this.#pending) {
      throw new Error("AI 请求仍在处理中。");
    }

    const userMessage = this.#appendMessage("user", normalized, "complete");
    const assistantMessage = this.#appendMessage("assistant", "", "streaming");
    const requestInput = [...this.#history, toInputItem(userMessage.text)];

    this.#providerMessageIds.clear();
    this.#pending = true;
    this.#errorMessage = null;
    this.#emitDelta([
      {
        type: "message.added",
        message: cloneMessage(userMessage),
      },
      {
        type: "message.added",
        message: cloneMessage(assistantMessage),
      },
      {
        type: "state.updated",
        patch: {
          pending: true,
          errorMessage: null,
        },
      },
    ]);

    void this.#runRequest(
      this.#client.stream({ instructions: AI_INSTRUCTIONS, input: requestInput }),
      {
        assistantMessageId: assistantMessage.id,
        requestInput,
      },
    );
  }

  resetConversation(): void {
    if (this.#pending) {
      throw new Error("AI 请求仍在处理中，暂时不能清空对话。");
    }

    this.#messages.length = 0;
    this.#history.length = 0;
    this.#providerMessageIds.clear();
    this.#errorMessage = null;
    this.#emitDelta([{ type: "conversation.reset" }]);
  }

  [Symbol.dispose](): void {
    this.#publisher[Symbol.dispose]();
  }

  #createSnapshot(): AiChatSnapshot {
    return {
      adapterKind: AI_ADAPTER_KIND,
      model: AI_MODEL,
      messages: this.#messages.map(cloneMessage),
      pending: this.#pending,
      errorMessage: this.#errorMessage,
    };
  }

  #emitDelta(ops: AiChatDeltaOp[]): void {
    if (ops.length === 0) {
      return;
    }

    this.#publisher.emit({
      kind: "delta",
      ops,
    });
  }

  #appendMessage(
    role: AiChatMessage["role"],
    text: string,
    status: AiChatMessage["status"],
  ): AiChatMessage {
    const message: AiChatMessage = {
      id: `ai-chat-${this.#messageCounter++}`,
      role,
      text,
      status,
      usage: null,
    };
    this.#messages.push(message);
    return message;
  }

  #patchMessage(id: string, patch: Partial<AiChatMessage>): void {
    const index = this.#messages.findIndex((message) => message.id === id);
    if (index < 0) {
      return;
    }

    this.#messages[index] = {
      ...this.#messages[index]!,
      ...patch,
    };
  }

  #removeMessage(id: string): boolean {
    const index = this.#messages.findIndex((message) => message.id === id);
    if (index < 0) {
      return false;
    }

    this.#messages.splice(index, 1);
    return true;
  }

  #appendMessageText(id: string, text: string): boolean {
    const message = this.#messages.find((candidate) => candidate.id === id);
    if (!message) {
      return false;
    }

    message.text += text;
    return true;
  }

  #cloneMessagePatch(patch: AiChatMessagePatch): AiChatMessagePatch {
    return {
      ...patch,
      usage: patch.usage ? { ...patch.usage } : patch.usage,
    };
  }

  async #runRequest(
    stream: AsyncIterable<AIStreamEvent>,
    context: {
      assistantMessageId: string;
      requestInput: InputItem[];
    },
  ): Promise<void> {
    let completedResponse: AIResponse | null = null;

    try {
      for await (const event of stream) {
        this.#handleStreamEvent(event, context.assistantMessageId);
        if (event.type === "response.completed") {
          completedResponse = event.response;
        }
      }

      if (completedResponse === null) {
        throw new Error("AI 流在完成前结束。");
      }

      const finalText = readResponseText(completedResponse);
      const completionPatch: AiChatMessagePatch = {
        status: "complete",
        usage: toMessageUsage(completedResponse.usage),
      };
      const assistantMessage = this.#messages.find(
        (message) => message.id === context.assistantMessageId,
      );
      if (assistantMessage && assistantMessage.text !== finalText) {
        completionPatch.text = finalText;
      }
      this.#patchMessage(context.assistantMessageId, completionPatch);
      this.#history.length = 0;
      this.#history.push(...context.requestInput, ...completedResponse.replay);
      this.#providerMessageIds.clear();
      this.#pending = false;
      this.#emitDelta([
        {
          type: "message.updated",
          messageId: context.assistantMessageId,
          patch: this.#cloneMessagePatch(completionPatch),
        },
        {
          type: "state.updated",
          patch: {
            pending: false,
          },
        },
      ]);
    } catch (error) {
      this.#pending = false;
      this.#errorMessage = toErrorMessage(error);
      this.#providerMessageIds.clear();
      const ops: AiChatDeltaOp[] = [];

      const assistantMessage = this.#messages.find(
        (message) => message.id === context.assistantMessageId,
      );
      if (assistantMessage?.text === "") {
        if (this.#removeMessage(context.assistantMessageId)) {
          ops.push({
            type: "message.removed",
            messageId: context.assistantMessageId,
          });
        }
      } else {
        this.#patchMessage(context.assistantMessageId, { status: "complete" });
        ops.push({
          type: "message.updated",
          messageId: context.assistantMessageId,
          patch: { status: "complete" },
        });
      }

      ops.push({
        type: "state.updated",
        patch: {
          pending: false,
          errorMessage: this.#errorMessage,
        },
      });
      this.#emitDelta(ops);
    }
  }

  #handleStreamEvent(event: AIStreamEvent, assistantMessageId: string): void {
    if (event.type === "message.started") {
      this.#providerMessageIds.set(event.item.id, assistantMessageId);
      return;
    }

    if (event.type !== "message.delta") {
      return;
    }

    const messageId = this.#providerMessageIds.get(event.itemId) ?? assistantMessageId;
    this.#providerMessageIds.set(event.itemId, messageId);
    if (!this.#appendMessageText(messageId, event.delta.text)) {
      return;
    }

    this.#emitDelta([
      {
        type: "message.text.delta",
        messageId,
        text: event.delta.text,
      },
    ]);
  }
}
