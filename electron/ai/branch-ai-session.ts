import type { AIClient, AIResponse, AIStreamEvent, InputItem } from "@codehz/ai";

import type {
  AiChatDeltaOp,
  AiChatEvent,
  AiChatMessage,
  AiChatMessagePatch,
  AiChatReasoning,
  AiChatReasoningPatch,
  AiChatSnapshot,
} from "#shared/rpc/ai-rpc";

import { RpcStreamPublisher } from "../lib/stream-publisher";
import {
  cloneMessage,
  readResponseReasoning,
  readResponseText,
  toErrorMessage,
  toMessageUsage,
} from "./ai-utils";
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
  readonly #providerReasoningIds = new Map<string, string>();
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
    this.#providerReasoningIds.clear();
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
    this.#providerReasoningIds.clear();
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
      reasoning: null,
    };
    this.#messages.push(message);
    return message;
  }

  #patchMessage(id: string, patch: AiChatMessagePatch): void {
    const index = this.#messages.findIndex((message) => message.id === id);
    if (index < 0) {
      return;
    }

    const current = this.#messages[index]!;
    this.#messages[index] = {
      ...current,
      ...patch,
      reasoning:
        patch.reasoning === undefined
          ? current.reasoning
          : patch.reasoning === null
            ? null
            : {
                text: current.reasoning?.text ?? "",
                visibility:
                  patch.reasoning.visibility ?? current.reasoning?.visibility ?? "summary",
                status: patch.reasoning.status ?? current.reasoning?.status ?? "streaming",
                ...patch.reasoning,
              },
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

  #ensureMessageReasoning(
    id: string,
    patch: Pick<AiChatReasoning, "visibility" | "status">,
  ): AiChatReasoning | null {
    const message = this.#messages.find((candidate) => candidate.id === id);
    if (!message) {
      return null;
    }

    if (message.reasoning === null) {
      message.reasoning = {
        text: "",
        visibility: patch.visibility,
        status: patch.status,
      };
      return message.reasoning;
    }

    message.reasoning.visibility = patch.visibility;
    message.reasoning.status = patch.status;
    return message.reasoning;
  }

  #appendMessageReasoningText(id: string, text: string): boolean {
    const message = this.#messages.find((candidate) => candidate.id === id);
    if (!message?.reasoning) {
      return false;
    }

    message.reasoning.text += text;
    return true;
  }

  #cloneMessagePatch(patch: AiChatMessagePatch): AiChatMessagePatch {
    return {
      ...patch,
      usage: patch.usage ? { ...patch.usage } : patch.usage,
      reasoning:
        patch.reasoning === undefined
          ? undefined
          : patch.reasoning === null
            ? null
            : { ...patch.reasoning },
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
      const finalReasoning = readResponseReasoning(completedResponse);
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
      if (finalReasoning) {
        const reasoningPatch: AiChatReasoningPatch = {
          visibility: finalReasoning.visibility,
          status: "complete",
        };
        if (assistantMessage?.reasoning?.text !== finalReasoning.text) {
          reasoningPatch.text = finalReasoning.text;
        }
        completionPatch.reasoning = reasoningPatch;
      } else if (assistantMessage?.reasoning) {
        completionPatch.reasoning = {
          status: "complete",
        };
      }
      this.#patchMessage(context.assistantMessageId, completionPatch);
      this.#history.length = 0;
      this.#history.push(...context.requestInput, ...completedResponse.replay);
      this.#providerMessageIds.clear();
      this.#providerReasoningIds.clear();
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
      this.#providerReasoningIds.clear();
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
        const errorPatch: AiChatMessagePatch = {
          status: "complete",
          reasoning: assistantMessage?.reasoning
            ? {
                status: "complete",
              }
            : undefined,
        };
        this.#patchMessage(context.assistantMessageId, errorPatch);
        ops.push({
          type: "message.updated",
          messageId: context.assistantMessageId,
          patch: this.#cloneMessagePatch(errorPatch),
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

    if (event.type === "reasoning.started") {
      this.#providerReasoningIds.set(event.item.id, assistantMessageId);
      this.#ensureMessageReasoning(assistantMessageId, {
        visibility: event.item.visibility,
        status: "streaming",
      });
      this.#emitDelta([
        {
          type: "message.updated",
          messageId: assistantMessageId,
          patch: {
            reasoning: {
              text: "",
              visibility: event.item.visibility,
              status: "streaming",
            },
          },
        },
      ]);
      return;
    }

    if (event.type === "reasoning.delta") {
      const messageId = this.#providerReasoningIds.get(event.itemId) ?? assistantMessageId;
      this.#providerReasoningIds.set(event.itemId, messageId);
      if (
        this.#ensureMessageReasoning(messageId, {
          visibility: "summary",
          status: "streaming",
        }) === null
      ) {
        return;
      }

      const deltaText =
        event.delta.type === "text"
          ? event.delta.text
          : event.delta.type === "json"
            ? JSON.stringify(event.delta.json, null, 2)
            : event.delta.type === "image"
              ? `[图片] ${event.delta.imageUrl}`
              : event.delta.type === "binary_ref"
                ? `[二进制引用] ${event.delta.ref}`
                : "[私有内容]";
      if (deltaText === "" || !this.#appendMessageReasoningText(messageId, deltaText)) {
        return;
      }

      this.#emitDelta([
        {
          type: "message.reasoning.delta",
          messageId,
          text: deltaText,
        },
      ]);
      return;
    }

    if (event.type === "reasoning.completed") {
      const providerReasoningId = event.item.id;
      const messageId = providerReasoningId
        ? (this.#providerReasoningIds.get(providerReasoningId) ?? assistantMessageId)
        : assistantMessageId;
      if (providerReasoningId) {
        this.#providerReasoningIds.delete(providerReasoningId);
      }
      const finalText = event.item.content
        .map((block) =>
          block.type === "text"
            ? block.text
            : block.type === "json"
              ? JSON.stringify(block.json, null, 2)
              : block.type === "image"
                ? `[图片] ${block.imageUrl}`
                : block.type === "binary_ref"
                  ? `[二进制引用] ${block.ref}`
                  : "[私有内容]",
        )
        .join("\n\n");
      const patch: AiChatMessagePatch = {
        reasoning: {
          visibility: event.item.visibility,
          status: "complete",
        },
      };
      const message = this.#messages.find((candidate) => candidate.id === messageId);
      if (message?.reasoning?.text !== finalText) {
        patch.reasoning = {
          ...patch.reasoning,
          text: finalText,
        };
      }
      this.#patchMessage(messageId, patch);
      this.#emitDelta([
        {
          type: "message.updated",
          messageId,
          patch: this.#cloneMessagePatch(patch),
        },
      ]);
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
