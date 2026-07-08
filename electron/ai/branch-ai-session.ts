import type { AIClient, AIResponse, AIStreamEvent, InputItem } from "@codehz/ai";
import { toolResultItem } from "@codehz/ai";

import {
  applyAiChatMessagePatch,
  cloneAiChatMessage,
  cloneAiChatMessagePatch,
  cloneAiChatToolCall,
  cloneAiChatToolCallPatch,
} from "#shared/rpc/ai-chat-state";
import type {
  AiChatDeltaOp,
  AiChatEvent,
  AiChatMessage,
  AiChatMessagePatch,
  AiChatReasoning,
  AiChatReasoningPatch,
  AiChatSnapshot,
  AiChatToolCall,
  AiChatToolCallPatch,
} from "#shared/rpc/ai-rpc";

import { RpcStreamPublisher } from "../lib/stream-publisher";
import type { WorktreeSession } from "../worktree/session";
import {
  joinContentBlocksText,
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
import { parseAskUserArgs } from "./tools/ask-user";
import { AI_TOOLS } from "./tools/definitions";
import { createToolRunner, type ToolRunner } from "./tools/runner";

type PendingUserToolContinuation = {
  assistantMessageId: string;
  input: InputItem[];
  transcript: InputItem[];
  toolCallId: string;
};

export class BranchAiSession {
  readonly #client: AIClient;
  readonly #toolRunner: ToolRunner;
  readonly #publisher = new RpcStreamPublisher<AiChatEvent>();
  readonly #messages: AiChatMessage[] = [];
  readonly #messageIndexById = new Map<string, number>();
  readonly #history: InputItem[] = [];
  readonly #providerMessageIds = new Map<string, string>();
  readonly #providerReasoningIds = new Map<string, string>();
  #pendingUserTool: PendingUserToolContinuation | null = null;
  #pending = false;
  #errorMessage: string | null = null;
  #messageCounter = 0;

  constructor(branchName: string, worktree: WorktreeSession) {
    this.#client = createMockClient(branchName);
    this.#toolRunner = createToolRunner(worktree);
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
    if (this.#pendingUserTool !== null) {
      throw new Error("AI 正在等待当前工具步骤的用户回答。");
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
        message: cloneAiChatMessage(userMessage),
      },
      {
        type: "message.added",
        message: cloneAiChatMessage(assistantMessage),
      },
      {
        type: "state.updated",
        patch: {
          pending: true,
          errorMessage: null,
        },
      },
    ]);

    void this.#runRequest({
      assistantMessageId: assistantMessage.id,
      requestInput,
    });
  }

  submitToolResponse(toolCallId: string, text: string): void {
    const pendingTool = this.#pendingUserTool;
    const normalized = text.trim();
    if (pendingTool === null || pendingTool.toolCallId !== toolCallId) {
      throw new Error("当前没有等待该工具调用的用户回答。");
    }
    if (normalized === "") {
      throw new Error("工具回答不能为空。");
    }
    if (this.#pending) {
      throw new Error("AI 请求仍在处理中。");
    }

    const toolCall = this.#getToolCall(pendingTool.assistantMessageId, toolCallId);
    if (!toolCall || toolCall.name !== "ask_user") {
      throw new Error("当前工具调用不是 ask_user。");
    }

    const args = parseAskUserArgs({
      type: "tool_call",
      id: toolCall.id,
      name: toolCall.name,
      argumentsText: toolCall.argumentsText,
    });
    const toolResult = toolResultItem(toolCall.id, toolCall.name, "success", [
      {
        type: "json",
        json: {
          question: args.question,
          context: args.context ?? null,
          placeholder: args.placeholder ?? null,
          answer: normalized,
        },
      },
    ]);

    this.#pending = true;
    this.#pendingUserTool = null;
    this.#emitToolCallUpdate(pendingTool.assistantMessageId, toolCallId, {
      status: "complete",
      resultText: JSON.stringify(
        {
          question: args.question,
          answer: normalized,
        },
        null,
        2,
      ),
      errorMessage: null,
    });
    this.#emitDelta([
      {
        type: "state.updated",
        patch: {
          pending: true,
          awaitingToolCallId: null,
          errorMessage: null,
        },
      },
    ]);

    void this.#runRequest({
      assistantMessageId: pendingTool.assistantMessageId,
      requestInput: [...pendingTool.input, toolResult],
      transcript: [...pendingTool.transcript, toolResult],
    });
  }

  resetConversation(): void {
    if (this.#pending) {
      throw new Error("AI 请求仍在处理中，暂时不能清空对话。");
    }

    this.#messages.length = 0;
    this.#messageIndexById.clear();
    this.#history.length = 0;
    this.#providerMessageIds.clear();
    this.#providerReasoningIds.clear();
    this.#pendingUserTool = null;
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
      messages: this.#messages.map(cloneAiChatMessage),
      pending: this.#pending,
      awaitingToolCallId: this.#pendingUserTool?.toolCallId ?? null,
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
      toolCalls: [],
    };
    this.#messages.push(message);
    this.#messageIndexById.set(message.id, this.#messages.length - 1);
    return message;
  }

  #getMessageIndex(id: string): number | null {
    return this.#messageIndexById.get(id) ?? null;
  }

  #getMessage(id: string): AiChatMessage | null {
    const index = this.#getMessageIndex(id);
    return index === null ? null : (this.#messages[index] ?? null);
  }

  #getToolCall(messageId: string, toolCallId: string): AiChatToolCall | null {
    const message = this.#getMessage(messageId);
    return message?.toolCalls.find((toolCall) => toolCall.id === toolCallId) ?? null;
  }

  #patchMessage(id: string, patch: AiChatMessagePatch): AiChatMessage | null {
    const index = this.#getMessageIndex(id);
    if (index === null) {
      return null;
    }

    const next = applyAiChatMessagePatch(this.#messages[index]!, patch);
    this.#messages[index] = next;
    return next;
  }

  #removeMessage(id: string): boolean {
    const index = this.#getMessageIndex(id);
    if (index === null) {
      return false;
    }

    this.#messages.splice(index, 1);
    this.#messageIndexById.delete(id);
    for (let i = index; i < this.#messages.length; i++) {
      this.#messageIndexById.set(this.#messages[i]!.id, i);
    }
    return true;
  }

  #appendMessageText(id: string, text: string): boolean {
    const message = this.#getMessage(id);
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
    const message = this.#getMessage(id);
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
    const message = this.#getMessage(id);
    if (!message?.reasoning) {
      return false;
    }

    message.reasoning.text += text;
    return true;
  }

  #appendToolCall(messageId: string, toolCall: AiChatToolCall): void {
    const message = this.#getMessage(messageId);
    if (!message) {
      return;
    }

    message.toolCalls.push(toolCall);
  }

  #patchToolCall(
    messageId: string,
    toolCallId: string,
    patch: AiChatToolCallPatch,
  ): AiChatToolCall | null {
    const message = this.#getMessage(messageId);
    if (!message) {
      return null;
    }

    const index = message.toolCalls.findIndex((toolCall) => toolCall.id === toolCallId);
    if (index === -1) {
      return null;
    }

    const next = {
      ...message.toolCalls[index]!,
      ...patch,
    };
    message.toolCalls[index] = next;
    return next;
  }

  #appendToolCallArguments(messageId: string, toolCallId: string, text: string): boolean {
    const toolCall = this.#getToolCall(messageId, toolCallId);
    if (!toolCall || text === "") {
      return false;
    }

    toolCall.argumentsText += text;
    return true;
  }

  #emitToolCallUpdate(messageId: string, toolCallId: string, patch: AiChatToolCallPatch): void {
    if (this.#patchToolCall(messageId, toolCallId, patch) === null) {
      return;
    }

    this.#emitDelta([
      {
        type: "tool_call.updated",
        messageId,
        toolCallId,
        patch: cloneAiChatToolCallPatch(patch),
      },
    ]);
  }

  async #consumeStream(
    stream: AsyncIterable<AIStreamEvent>,
    assistantMessageId: string,
  ): Promise<AIResponse> {
    let completedResponse: AIResponse | null = null;

    for await (const event of stream) {
      this.#handleStreamEvent(event, assistantMessageId);
      if (event.type === "response.completed") {
        completedResponse = event.response;
      }
    }

    if (completedResponse === null) {
      throw new Error("AI 流在完成前结束。");
    }

    return completedResponse;
  }

  async #runRequest(context: {
    assistantMessageId: string;
    requestInput: InputItem[];
    transcript?: InputItem[];
  }): Promise<void> {
    let input = [...context.requestInput];
    const transcript = context.transcript ? [...context.transcript] : [...context.requestInput];
    let completedResponse: AIResponse | null = null;

    try {
      while (true) {
        completedResponse = await this.#consumeStream(
          this.#client.stream({
            instructions: AI_INSTRUCTIONS,
            input,
            tools: AI_TOOLS,
          }),
          context.assistantMessageId,
        );

        transcript.push(...completedResponse.replay);

        if (
          completedResponse.stopReason !== "tool_call" ||
          completedResponse.toolCalls.length === 0
        ) {
          break;
        }

        input = [...input, ...completedResponse.replay];
        for (const call of completedResponse.toolCalls) {
          this.#emitToolCallUpdate(context.assistantMessageId, call.id, {
            status: "running",
          });

          const execution = await this.#toolRunner.execute(call);
          if (execution.awaitUserInput) {
            this.#pending = false;
            this.#pendingUserTool = {
              assistantMessageId: context.assistantMessageId,
              input: [...input],
              transcript: [...transcript],
              toolCallId: call.id,
            };
            this.#emitToolCallUpdate(context.assistantMessageId, call.id, {
              status: "awaiting_user",
              resultText: null,
              errorMessage: null,
            });
            this.#emitDelta([
              {
                type: "state.updated",
                patch: {
                  pending: false,
                  awaitingToolCallId: call.id,
                  errorMessage: null,
                },
              },
            ]);
            return;
          }

          this.#emitToolCallUpdate(context.assistantMessageId, call.id, {
            status: execution.errorMessage === null ? "complete" : "error",
            resultText: execution.resultText,
            errorMessage: execution.errorMessage,
          });
          input.push(execution.toolResult);
          transcript.push(execution.toolResult);
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
      const assistantMessage = this.#getMessage(context.assistantMessageId);
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
      this.#history.push(...transcript);
      this.#providerMessageIds.clear();
      this.#providerReasoningIds.clear();
      this.#pendingUserTool = null;
      this.#pending = false;
      this.#emitDelta([
        {
          type: "message.updated",
          messageId: context.assistantMessageId,
          patch: cloneAiChatMessagePatch(completionPatch),
        },
        {
          type: "state.updated",
          patch: {
            pending: false,
            awaitingToolCallId: null,
          },
        },
      ]);
    } catch (error) {
      this.#pending = false;
      this.#pendingUserTool = null;
      this.#errorMessage = toErrorMessage(error);
      this.#providerMessageIds.clear();
      this.#providerReasoningIds.clear();
      const ops: AiChatDeltaOp[] = [];

      const assistantMessage = this.#getMessage(context.assistantMessageId);
      if (assistantMessage?.text === "" && assistantMessage.toolCalls.length === 0) {
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
          patch: cloneAiChatMessagePatch(errorPatch),
        });
      }

      ops.push({
        type: "state.updated",
        patch: {
          pending: false,
          awaitingToolCallId: null,
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

    if (event.type === "tool_call.started") {
      const toolCall: AiChatToolCall = {
        id: event.item.id,
        name: event.item.name,
        argumentsText: "",
        status: "pending",
        resultText: null,
        errorMessage: null,
      };
      this.#appendToolCall(assistantMessageId, toolCall);
      this.#emitDelta([
        {
          type: "tool_call.added",
          messageId: assistantMessageId,
          toolCall: cloneAiChatToolCall(toolCall),
        },
      ]);
      return;
    }

    if (event.type === "tool_call.delta") {
      if (
        !this.#appendToolCallArguments(
          assistantMessageId,
          event.itemId,
          event.delta.argumentsText ?? "",
        )
      ) {
        return;
      }

      const toolCall = this.#getToolCall(assistantMessageId, event.itemId);
      if (!toolCall) {
        return;
      }

      this.#emitDelta([
        {
          type: "tool_call.updated",
          messageId: assistantMessageId,
          toolCallId: event.itemId,
          patch: {
            argumentsText: toolCall.argumentsText,
          },
        },
      ]);
      return;
    }

    if (event.type === "tool_call.completed") {
      this.#emitToolCallUpdate(assistantMessageId, event.item.id, {
        argumentsText: event.item.argumentsText,
        status: "pending",
      });
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
      const finalText = joinContentBlocksText(event.item.content);
      const patch: AiChatMessagePatch = {
        reasoning: {
          visibility: event.item.visibility,
          status: "complete",
        },
      };
      const message = this.#getMessage(messageId);
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
          patch: cloneAiChatMessagePatch(patch),
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
