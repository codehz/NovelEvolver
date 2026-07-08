import type {
  AIClient,
  AIResponse,
  AIStreamEvent,
  InputItem,
  OutputItem,
  ToolCallItem,
  ToolResultItem,
} from "@codehz/ai";
import { toolResultItem } from "@codehz/ai";

import {
  applyAiChatMessagePatch,
  cloneAiChatAssistantPart,
  cloneAiChatAssistantPartPatch,
  cloneAiChatMessage,
  cloneAiChatMessagePatch,
} from "#shared/rpc/ai-chat-state";
import type {
  AiChatAssistantMessage,
  AiChatAssistantPart,
  AiChatAssistantPartPatch,
  AiChatDeltaOp,
  AiChatEvent,
  AiChatMessage,
  AiChatMessagePatch,
  AiChatSnapshot,
  AiChatToolCall,
  AiChatUserMessage,
} from "#shared/rpc/ai-rpc";

import { RpcStreamPublisher } from "../lib/stream-publisher";
import type { WorktreeSession } from "../worktree/session";
import { joinContentBlocksText, toErrorMessage, toMessageUsage } from "./ai-utils";
import {
  AI_ADAPTER_KIND,
  AI_INSTRUCTIONS,
  AI_MODEL,
  createMockClient,
  toInputItem,
} from "./mock-adapter";
import { AI_TOOLS } from "./tools/definitions";
import { createToolRunner, type ToolRunner } from "./tools/runner";

type PendingToolBatch = {
  assistantMessageId: string;
  calls: ToolCallItem[];
  input: InputItem[];
  transcript: InputItem[];
  resultsByCallId: Map<string, ToolResultItem>;
  awaitingAskUserIds: Set<string>;
};

export class BranchAiSession {
  readonly #client: AIClient;
  readonly #toolRunner: ToolRunner;
  readonly #publisher = new RpcStreamPublisher<AiChatEvent>();
  readonly #messages: AiChatMessage[] = [];
  readonly #messageIndexById = new Map<string, number>();
  readonly #history: InputItem[] = [];
  #pendingToolBatch: PendingToolBatch | null = null;
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
    if (this.#pendingToolBatch !== null) {
      throw new Error("AI 正在等待当前工具步骤的用户回答。");
    }

    const userMessage = this.#appendUserMessage(normalized);
    const assistantMessage = this.#appendAssistantMessage();
    const requestInput = [...this.#history, toInputItem(userMessage.text)];

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
    const pendingBatch = this.#pendingToolBatch;
    const normalized = text.trim();
    if (pendingBatch === null || !pendingBatch.awaitingAskUserIds.has(toolCallId)) {
      throw new Error("当前没有等待该工具调用的用户回答。");
    }
    if (normalized === "") {
      throw new Error("工具回答不能为空。");
    }
    if (this.#pending) {
      throw new Error("AI 请求仍在处理中。");
    }

    const toolCall = this.#getToolCall(pendingBatch.assistantMessageId, toolCallId);
    if (!toolCall || toolCall.name !== "ask_user") {
      throw new Error("当前工具调用不是 ask_user。");
    }

    const toolResult = toolResultItem(toolCall.id, toolCall.name, "success", [
      {
        type: "json",
        json: {
          answer: normalized,
        },
      },
    ]);

    pendingBatch.resultsByCallId.set(toolCallId, toolResult);
    pendingBatch.awaitingAskUserIds.delete(toolCallId);
    this.#emitAssistantPartUpdate(pendingBatch.assistantMessageId, toolCallId, {
      status: "complete",
      resultText: JSON.stringify(
        {
          answer: normalized,
        },
        null,
        2,
      ),
      errorMessage: null,
    });

    if (pendingBatch.awaitingAskUserIds.size > 0) {
      this.#emitDelta([
        {
          type: "state.updated",
          patch: {
            awaitingAskUserToolCallIds: [...pendingBatch.awaitingAskUserIds],
            errorMessage: null,
          },
        },
      ]);
      return;
    }

    const input = [...pendingBatch.input];
    const transcript = [...pendingBatch.transcript];
    this.#appendBatchResultsToConversation(pendingBatch, input, transcript);
    const assistantMessageId = pendingBatch.assistantMessageId;

    this.#pendingToolBatch = null;
    this.#pending = true;
    this.#emitDelta([
      {
        type: "state.updated",
        patch: {
          pending: true,
          awaitingAskUserToolCallIds: [],
          errorMessage: null,
        },
      },
    ]);

    void this.#runRequest({
      assistantMessageId,
      requestInput: input,
      transcript,
    });
  }

  resetConversation(): void {
    if (this.#pending || this.#pendingToolBatch !== null) {
      throw new Error("AI 请求仍在处理中，暂时不能清空对话。");
    }

    this.#messages.length = 0;
    this.#messageIndexById.clear();
    this.#history.length = 0;
    this.#pendingToolBatch = null;
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
      awaitingAskUserToolCallIds: this.#pendingToolBatch
        ? [...this.#pendingToolBatch.awaitingAskUserIds]
        : [],
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

  #appendUserMessage(text: string): AiChatUserMessage {
    const message: AiChatUserMessage = {
      id: `ai-chat-${this.#messageCounter++}`,
      role: "user",
      text,
      status: "complete",
    };
    this.#messages.push(message);
    this.#messageIndexById.set(message.id, this.#messages.length - 1);
    return message;
  }

  #appendAssistantMessage(): AiChatAssistantMessage {
    const message: AiChatAssistantMessage = {
      id: `ai-chat-${this.#messageCounter++}`,
      role: "assistant",
      status: "streaming",
      usage: null,
      parts: [],
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

  #getAssistantMessage(id: string): AiChatAssistantMessage | null {
    const message = this.#getMessage(id);
    return message?.role === "assistant" ? message : null;
  }

  #getToolCall(messageId: string, toolCallId: string): AiChatToolCall | null {
    const message = this.#getAssistantMessage(messageId);
    if (!message) {
      return null;
    }

    for (const part of message.parts) {
      if (part.type === "tool_call" && part.id === toolCallId) {
        return part;
      }
    }
    return null;
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

  #appendAssistantPart(messageId: string, part: AiChatAssistantPart): boolean {
    const message = this.#getAssistantMessage(messageId);
    if (!message) {
      return false;
    }

    message.parts.push(part);
    return true;
  }

  #countAssistantParts(messageId: string): number {
    return this.#getAssistantMessage(messageId)?.parts.length ?? 0;
  }

  #patchAssistantPart(
    messageId: string,
    partId: string,
    patch: AiChatAssistantPartPatch,
  ): AiChatAssistantPart | null {
    const message = this.#getAssistantMessage(messageId);
    if (!message) {
      return null;
    }

    const index = message.parts.findIndex((part) => part.id === partId);
    if (index === -1) {
      return null;
    }

    const current = message.parts[index]!;
    let next: AiChatAssistantPart;
    switch (current.type) {
      case "message":
        next = {
          ...current,
          text: patch.text ?? current.text,
          status:
            patch.status === "streaming" || patch.status === "complete"
              ? patch.status
              : current.status,
        };
        break;
      case "reasoning":
        next = {
          ...current,
          text: patch.text ?? current.text,
          visibility: patch.visibility ?? current.visibility,
          status:
            patch.status === "streaming" || patch.status === "complete"
              ? patch.status
              : current.status,
        };
        break;
      case "tool_call":
        next = {
          ...current,
          argumentsText: patch.argumentsText ?? current.argumentsText,
          status:
            patch.status === undefined ||
            patch.status === "streaming" ||
            patch.status === "complete"
              ? current.status
              : patch.status,
          resultText: patch.resultText !== undefined ? patch.resultText : current.resultText,
          errorMessage:
            patch.errorMessage !== undefined ? patch.errorMessage : current.errorMessage,
        };
        break;
    }

    message.parts[index] = next;
    return next;
  }

  #appendAssistantPartText(messageId: string, partId: string, text: string): boolean {
    const message = this.#getAssistantMessage(messageId);
    if (!message || text === "") {
      return false;
    }

    const part = message.parts.find((candidate) => candidate.id === partId);
    if (!part || part.type === "tool_call") {
      return false;
    }

    part.text += text;
    return true;
  }

  #emitAssistantPartUpdate(
    messageId: string,
    partId: string,
    patch: AiChatAssistantPartPatch,
  ): void {
    if (this.#patchAssistantPart(messageId, partId, patch) === null) {
      return;
    }

    this.#emitDelta([
      {
        type: "assistant_part.updated",
        messageId,
        partId,
        patch: cloneAiChatAssistantPartPatch(patch),
      },
    ]);
  }

  #emitAssistantPartTextDelta(messageId: string, partId: string, text: string): void {
    if (!this.#appendAssistantPartText(messageId, partId, text)) {
      return;
    }

    this.#emitDelta([
      {
        type: "assistant_part.text.delta",
        messageId,
        partId,
        text,
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
        const streamStartPartCount = this.#countAssistantParts(context.assistantMessageId);
        completedResponse = await this.#consumeStream(
          this.#client.stream({
            instructions: AI_INSTRUCTIONS,
            input,
            tools: AI_TOOLS,
          }),
          context.assistantMessageId,
        );

        this.#reconcileAssistantResponse(
          context.assistantMessageId,
          streamStartPartCount,
          completedResponse,
        );
        transcript.push(...completedResponse.replay);

        if (
          completedResponse.stopReason !== "tool_call" ||
          completedResponse.toolCalls.length === 0
        ) {
          break;
        }

        input = [...input, ...completedResponse.replay];
        const batchOutcome = await this.#processToolBatch(
          context.assistantMessageId,
          completedResponse.toolCalls,
          input,
          transcript,
        );
        if (batchOutcome === "paused") {
          return;
        }
      }

      if (completedResponse === null) {
        throw new Error("AI 流在完成前结束。");
      }

      const completionPatch: AiChatMessagePatch = {
        status: "complete",
        usage: toMessageUsage(completedResponse.usage),
      };
      this.#patchMessage(context.assistantMessageId, completionPatch);
      this.#history.length = 0;
      this.#history.push(...transcript);
      this.#pendingToolBatch = null;
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
            awaitingAskUserToolCallIds: [],
          },
        },
      ]);
    } catch (error) {
      this.#pending = false;
      this.#pendingToolBatch = null;
      this.#errorMessage = toErrorMessage(error);
      const ops: AiChatDeltaOp[] = [];

      const assistantMessage = this.#getAssistantMessage(context.assistantMessageId);
      if (!assistantMessage || assistantMessage.parts.length === 0) {
        if (this.#removeMessage(context.assistantMessageId)) {
          ops.push({
            type: "message.removed",
            messageId: context.assistantMessageId,
          });
        }
      } else {
        const errorPatch: AiChatMessagePatch = {
          status: "complete",
        };
        this.#patchMessage(context.assistantMessageId, errorPatch);
        ops.push({
          type: "message.updated",
          messageId: context.assistantMessageId,
          patch: cloneAiChatMessagePatch(errorPatch),
        });
        ops.push(...this.#completeStreamingAssistantParts(context.assistantMessageId));
      }

      ops.push({
        type: "state.updated",
        patch: {
          pending: false,
          awaitingAskUserToolCallIds: [],
          errorMessage: this.#errorMessage,
        },
      });
      this.#emitDelta(ops);
    }
  }

  async #processToolBatch(
    assistantMessageId: string,
    calls: ToolCallItem[],
    input: InputItem[],
    transcript: InputItem[],
  ): Promise<"continue" | "paused"> {
    const resultsByCallId = new Map<string, ToolResultItem>();
    const awaitingAskUserIds = new Set<string>();

    for (const call of calls) {
      this.#emitAssistantPartUpdate(assistantMessageId, call.id, {
        status: "running",
      });

      const execution = await this.#toolRunner.execute(call);
      if (execution.awaitUserInput) {
        this.#emitAssistantPartUpdate(assistantMessageId, call.id, {
          status: "awaiting_user",
          resultText: null,
          errorMessage: null,
        });
        awaitingAskUserIds.add(call.id);
        continue;
      }

      this.#emitAssistantPartUpdate(assistantMessageId, call.id, {
        status: execution.errorMessage === null ? "complete" : "error",
        resultText: execution.resultText,
        errorMessage: execution.errorMessage,
      });
      resultsByCallId.set(call.id, execution.toolResult);
    }

    if (awaitingAskUserIds.size > 0) {
      this.#pending = false;
      this.#pendingToolBatch = {
        assistantMessageId,
        calls,
        input: [...input],
        transcript: [...transcript],
        resultsByCallId,
        awaitingAskUserIds,
      };
      this.#emitDelta([
        {
          type: "state.updated",
          patch: {
            pending: false,
            awaitingAskUserToolCallIds: [...awaitingAskUserIds],
            errorMessage: null,
          },
        },
      ]);
      return "paused";
    }

    for (const call of calls) {
      const result = resultsByCallId.get(call.id);
      if (!result) {
        continue;
      }
      input.push(result);
      transcript.push(result);
    }

    return "continue";
  }

  #appendBatchResultsToConversation(
    batch: PendingToolBatch,
    input: InputItem[],
    transcript: InputItem[],
  ): void {
    for (const call of batch.calls) {
      const result = batch.resultsByCallId.get(call.id);
      if (!result) {
        throw new Error(`工具 ${call.id} 缺少执行结果。`);
      }
      input.push(result);
      transcript.push(result);
    }
  }

  #completeStreamingAssistantParts(messageId: string): AiChatDeltaOp[] {
    const message = this.#getAssistantMessage(messageId);
    if (!message) {
      return [];
    }

    const ops: AiChatDeltaOp[] = [];
    for (const part of message.parts) {
      if (part.type === "message" || part.type === "reasoning") {
        if (part.status !== "complete") {
          part.status = "complete";
          ops.push({
            type: "assistant_part.updated",
            messageId,
            partId: part.id,
            patch: {
              status: "complete",
            },
          });
        }
      }
    }
    return ops;
  }

  #createCanonicalPart(
    item: OutputItem,
    fallback: AiChatAssistantPart | null,
    synthId: string,
  ): AiChatAssistantPart | null {
    switch (item.type) {
      case "message":
        return {
          id: item.id ?? fallback?.id ?? synthId,
          type: "message",
          text: joinContentBlocksText(item.content),
          status: "complete",
        };
      case "reasoning":
        return {
          id: item.id ?? fallback?.id ?? synthId,
          type: "reasoning",
          text: joinContentBlocksText(item.content),
          visibility: item.visibility,
          status: "complete",
        };
      case "tool_call":
        return {
          id: item.id ?? fallback?.id ?? synthId,
          type: "tool_call",
          name: item.name,
          argumentsText: item.argumentsText,
          status: fallback?.type === "tool_call" ? fallback.status : "pending",
          resultText: fallback?.type === "tool_call" ? fallback.resultText : null,
          errorMessage: fallback?.type === "tool_call" ? fallback.errorMessage : null,
        };
      case "opaque":
        return null;
    }
  }

  #findFallbackPart(
    parts: readonly AiChatAssistantPart[],
    type: AiChatAssistantPart["type"],
    usedIds: Set<string>,
  ): AiChatAssistantPart | null {
    for (const part of parts) {
      if (part.type === type && !usedIds.has(part.id)) {
        usedIds.add(part.id);
        return part;
      }
    }
    return null;
  }

  #buildPartPatch(
    current: AiChatAssistantPart,
    canonical: AiChatAssistantPart,
  ): AiChatAssistantPartPatch | null {
    if (current.type !== canonical.type) {
      return null;
    }

    switch (canonical.type) {
      case "message": {
        if (current.type !== "message") {
          return null;
        }
        const currentMessage = current;
        const patch: AiChatAssistantPartPatch = {};
        if (currentMessage.text !== canonical.text) {
          patch.text = canonical.text;
        }
        if (currentMessage.status !== canonical.status) {
          patch.status = canonical.status;
        }
        return Object.keys(patch).length > 0 ? patch : null;
      }
      case "reasoning": {
        if (current.type !== "reasoning") {
          return null;
        }
        const patch: AiChatAssistantPartPatch = {};
        if (current.text !== canonical.text) {
          patch.text = canonical.text;
        }
        if (current.visibility !== canonical.visibility) {
          patch.visibility = canonical.visibility;
        }
        if (current.status !== canonical.status) {
          patch.status = canonical.status;
        }
        return Object.keys(patch).length > 0 ? patch : null;
      }
      case "tool_call": {
        if (current.type !== "tool_call") {
          return null;
        }
        const patch: AiChatAssistantPartPatch = {};
        if (current.argumentsText !== canonical.argumentsText) {
          patch.argumentsText = canonical.argumentsText;
        }
        if (current.status !== canonical.status) {
          patch.status = canonical.status;
        }
        if (current.resultText !== canonical.resultText) {
          patch.resultText = canonical.resultText;
        }
        if (current.errorMessage !== canonical.errorMessage) {
          patch.errorMessage = canonical.errorMessage;
        }
        return Object.keys(patch).length > 0 ? patch : null;
      }
    }
  }

  #reconcileAssistantResponse(
    messageId: string,
    streamStartPartCount: number,
    response: AIResponse,
  ): void {
    const message = this.#getAssistantMessage(messageId);
    if (!message) {
      return;
    }

    const streamedParts = message.parts.slice(streamStartPartCount);
    const usedFallbackIds = new Set<string>();
    const canonicalParts = response.output.flatMap((item, index) => {
      const fallback =
        item.type === "opaque"
          ? null
          : this.#findFallbackPart(streamedParts, item.type, usedFallbackIds);
      const canonical = this.#createCanonicalPart(
        item,
        fallback,
        `${messageId}-part-${streamStartPartCount + index}`,
      );
      return canonical ? [canonical] : [];
    });

    for (let i = 0; i < canonicalParts.length; i++) {
      const canonical = canonicalParts[i]!;
      const current = message.parts[streamStartPartCount + i];

      if (!current) {
        message.parts.push(canonical);
        this.#emitDelta([
          {
            type: "assistant_part.added",
            messageId,
            part: cloneAiChatAssistantPart(canonical),
          },
        ]);
        continue;
      }

      if (current.id !== canonical.id || current.type !== canonical.type) {
        const patch = this.#buildPartPatch(current, canonical);
        if (patch) {
          this.#emitAssistantPartUpdate(messageId, current.id, patch);
        }
        continue;
      }

      const patch = this.#buildPartPatch(current, canonical);
      if (patch) {
        this.#emitAssistantPartUpdate(messageId, current.id, patch);
      }
    }
  }

  #handleStreamEvent(event: AIStreamEvent, assistantMessageId: string): void {
    if (event.type === "message.started") {
      const part: AiChatAssistantPart = {
        id: event.item.id,
        type: "message",
        text: "",
        status: "streaming",
      };
      this.#appendAssistantPart(assistantMessageId, part);
      this.#emitDelta([
        {
          type: "assistant_part.added",
          messageId: assistantMessageId,
          part: cloneAiChatAssistantPart(part),
        },
      ]);
      return;
    }

    if (event.type === "message.delta") {
      this.#emitAssistantPartTextDelta(assistantMessageId, event.itemId, event.delta.text);
      return;
    }

    if (event.type === "message.completed") {
      this.#emitAssistantPartUpdate(assistantMessageId, event.item.id ?? "", {
        text: joinContentBlocksText(event.item.content),
        status: "complete",
      });
      return;
    }

    if (event.type === "reasoning.started") {
      const part: AiChatAssistantPart = {
        id: event.item.id,
        type: "reasoning",
        text: "",
        visibility: event.item.visibility,
        status: "streaming",
      };
      this.#appendAssistantPart(assistantMessageId, part);
      this.#emitDelta([
        {
          type: "assistant_part.added",
          messageId: assistantMessageId,
          part: cloneAiChatAssistantPart(part),
        },
      ]);
      return;
    }

    if (event.type === "reasoning.delta") {
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
      if (deltaText === "") {
        return;
      }
      this.#emitAssistantPartTextDelta(assistantMessageId, event.itemId, deltaText);
      return;
    }

    if (event.type === "reasoning.completed") {
      this.#emitAssistantPartUpdate(assistantMessageId, event.item.id ?? "", {
        text: joinContentBlocksText(event.item.content),
        visibility: event.item.visibility,
        status: "complete",
      });
      return;
    }

    if (event.type === "tool_call.started") {
      const part: AiChatAssistantPart = {
        id: event.item.id,
        type: "tool_call",
        name: event.item.name,
        argumentsText: "",
        status: "pending",
        resultText: null,
        errorMessage: null,
      };
      this.#appendAssistantPart(assistantMessageId, part);
      this.#emitDelta([
        {
          type: "assistant_part.added",
          messageId: assistantMessageId,
          part: cloneAiChatAssistantPart(part),
        },
      ]);
      return;
    }

    if (event.type === "tool_call.delta") {
      const toolCall = this.#getToolCall(assistantMessageId, event.itemId);
      if (!toolCall) {
        return;
      }

      const argumentsText = `${toolCall.argumentsText}${event.delta.argumentsText ?? ""}`;
      this.#emitAssistantPartUpdate(assistantMessageId, event.itemId, {
        argumentsText,
      });
      return;
    }

    if (event.type === "tool_call.completed") {
      this.#emitAssistantPartUpdate(assistantMessageId, event.item.id, {
        argumentsText: event.item.argumentsText,
      });
    }
  }
}
