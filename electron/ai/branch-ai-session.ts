import type { AIResponse, AIStreamEvent, InputItem } from "@codehz/ai";

import type { AiChatMessage, AiChatSnapshot } from "#shared/rpc/ai-rpc";

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
  readonly #branchName: string;
  readonly #publisher = new RpcStreamPublisher<AiChatSnapshot>();
  readonly #messages: AiChatMessage[] = [];
  readonly #history: InputItem[] = [];
  #pending = false;
  #errorMessage: string | null = null;
  #messageCounter = 0;

  constructor(branchName: string) {
    this.#branchName = branchName;
  }

  subscribe(): ReadableStream<AiChatSnapshot> {
    return this.#publisher.subscribe({
      getInitialValue: () => this.#createSnapshot(),
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

    this.#pending = true;
    this.#errorMessage = null;
    this.#emitSnapshot();

    const client = createMockClient(this.#branchName, normalized);

    void this.#runRequest(client.stream({ instructions: AI_INSTRUCTIONS, input: requestInput }), {
      assistantMessageId: assistantMessage.id,
      requestInput,
    });
  }

  resetConversation(): void {
    if (this.#pending) {
      throw new Error("AI 请求仍在处理中，暂时不能清空对话。");
    }

    this.#messages.length = 0;
    this.#history.length = 0;
    this.#errorMessage = null;
    this.#emitSnapshot();
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

  #emitSnapshot(): void {
    this.#publisher.emit(this.#createSnapshot());
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
      this.#patchMessage(context.assistantMessageId, {
        text: finalText,
        status: "complete",
        usage: toMessageUsage(completedResponse.usage),
      });
      this.#history.length = 0;
      this.#history.push(...context.requestInput, ...completedResponse.replay);
      this.#pending = false;
      this.#emitSnapshot();
    } catch (error) {
      this.#pending = false;
      this.#errorMessage = toErrorMessage(error);

      const assistantMessage = this.#messages.find(
        (message) => message.id === context.assistantMessageId,
      );
      if (assistantMessage?.text === "") {
        const index = this.#messages.findIndex(
          (message) => message.id === context.assistantMessageId,
        );
        if (index >= 0) {
          this.#messages.splice(index, 1);
        }
      } else {
        this.#patchMessage(context.assistantMessageId, { status: "complete" });
      }

      this.#emitSnapshot();
    }
  }

  #handleStreamEvent(event: AIStreamEvent, assistantMessageId: string): void {
    if (event.type !== "message.delta" || event.itemId !== assistantMessageId) {
      return;
    }

    const assistantMessage = this.#messages.find((message) => message.id === assistantMessageId);
    if (!assistantMessage) {
      return;
    }

    this.#patchMessage(assistantMessageId, {
      text: `${assistantMessage.text}${event.delta.text}`,
    });
    this.#emitSnapshot();
  }
}
