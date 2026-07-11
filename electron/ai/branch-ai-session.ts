import { randomUUID } from "node:crypto";

import type {
  AIClient,
  AIResponse,
  AIStreamEvent,
  InputItem,
  OutputItem,
  ToolCallItem,
  ToolResultItem,
} from "@codehz/ai";

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
  AiChatUserInputHandle,
  AiChatUserMessage,
  AiConversationSummary,
} from "#shared/rpc/ai-rpc";

import type { AiChatRepository, AiConversationRecord } from "../db/repositories/ai-chat-repo";
import { RpcStreamPublisher } from "../lib/stream-publisher";
import { joinContentBlocksText, toErrorMessage, toMessageUsage } from "./ai-utils";
import {
  AI_ADAPTER_KIND,
  AI_INSTRUCTIONS,
  AI_MODEL,
  createMockClient,
  toInputItem,
} from "./mock-adapter";
import { AskUserRequestHandleImpl, parseAskUserArgs } from "./tools/ask-user";
import { AI_TOOLS } from "./tools/definitions";
import { createToolRunner, type ResolveWorktree, type ToolRunner } from "./tools/runner";
import type { UserInputRequest } from "./tools/user-input-types";

const EMPTY_TITLE = "新会话";
const TITLE_MAX_LENGTH = 40;

type PendingUserInput = {
  callId: string;
  handle: AiChatUserInputHandle;
  resolverPromise: Promise<ToolResultItem>;
  resolve: (result: ToolResultItem) => void;
  /** 纯数据形式，用于持久化与重开 app 后重建 handle。 */
  serializable: { toolName: string; args: unknown };
};

type PendingToolBatch = {
  assistantMessageId: string;
  calls: ToolCallItem[];
  input: InputItem[];
  transcript: InputItem[];
  /** 已有结果的工具调用（自动完成的 + 用户已回答的）。 */
  resolvedResultsByCallId: Map<string, ToolResultItem>;
  /** 仍等待用户输入的工具调用。 */
  pendingInputs: PendingUserInput[];
};

type SerializedPendingToolBatch = {
  assistantMessageId: string;
  calls: ToolCallItem[];
  input: InputItem[];
  transcript: InputItem[];
  resolvedResultsByCallId: [string, ToolResultItem][];
  /** 仍等待用户输入的工具调用的纯数据形式。 */
  pendingInputs: { callId: string; serializable: { toolName: string; args: unknown } }[];
};

export type ProjectAiSessionOptions = {
  projectId: number;
  repository: AiChatRepository;
  resolveWorktree: ResolveWorktree;
  /** Mock client label; falls back to project id. */
  clientLabel?: string;
};

/**
 * Project-scoped AI conversation runtime.
 *
 * Persists idle snapshots into app-state (`ai_conversation`) and restores the
 * most recently active conversation on construction.
 */
export class BranchAiSession {
  readonly #projectId: number;
  readonly #repository: AiChatRepository;
  readonly #client: AIClient;
  readonly #toolRunner: ToolRunner;
  readonly #publisher = new RpcStreamPublisher<AiChatEvent>();
  readonly #messages: AiChatMessage[] = [];
  readonly #messageIndexById = new Map<string, number>();
  readonly #history: InputItem[] = [];
  #conversationId = "";
  #title = EMPTY_TITLE;
  #createdAt = 0;
  #status: "active" | "archived" = "active";
  #pendingToolBatch: PendingToolBatch | null = null;
  #pending = false;
  #errorMessage: string | null = null;
  #messageCounter = 0;
  #dirty = false;
  #disposed = false;

  constructor(options: ProjectAiSessionOptions) {
    this.#projectId = options.projectId;
    this.#repository = options.repository;
    this.#client = createMockClient(options.clientLabel ?? `project-${options.projectId}`);
    this.#toolRunner = createToolRunner(options.resolveWorktree);
    this.#hydrateOnOpen();
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

  createConversation(): void {
    this.#assertIdleForConversationSwitch("新建");
    this.#persistIfNeeded();

    if (
      this.#messages.length === 0 &&
      this.#pendingToolBatch === null &&
      this.#errorMessage === null
    ) {
      // Already an empty draft — no-op besides ensuring a stable id exists.
      if (this.#conversationId === "") {
        this.#beginEmptyConversation();
        this.#emitSnapshot();
      }
      return;
    }

    this.#beginEmptyConversation();
    this.#emitSnapshot();
  }

  listConversations(): AiConversationSummary[] {
    return this.#repository.listByProject(this.#projectId).map((record) => ({
      id: record.id,
      title: record.title,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      lastActiveAt: record.lastActiveAt,
    }));
  }

  switchConversation(conversationId: string): void {
    const normalized = conversationId.trim();
    if (normalized === "") {
      throw new Error("会话 id 不能为空。");
    }
    this.#assertIdleForConversationSwitch("切换");
    if (normalized === this.#conversationId) {
      return;
    }

    this.#persistIfNeeded();

    const record = this.#repository.getById(this.#projectId, normalized);
    if (!record) {
      throw new Error("找不到指定的 AI 会话。");
    }

    this.#loadRecord(record);
    // Touch last_active_at so reopen restores the conversation just selected.
    this.#markDirty();
    this.#persistIfNeeded();
    this.#emitSnapshot();
  }

  [Symbol.dispose](): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    try {
      this.#persistIfNeeded();
    } finally {
      this.#publisher[Symbol.dispose]();
    }
  }

  #hydrateOnOpen(): void {
    const latest = this.#repository.getLatestByProject(this.#projectId);
    if (latest) {
      this.#loadRecord(latest);
      return;
    }
    this.#beginEmptyConversation();
  }

  #beginEmptyConversation(): void {
    this.#conversationId = randomUUID();
    this.#title = EMPTY_TITLE;
    this.#createdAt = Date.now();
    this.#status = "active";
    this.#messages.length = 0;
    this.#messageIndexById.clear();
    this.#history.length = 0;
    this.#pendingToolBatch = null;
    this.#pending = false;
    this.#errorMessage = null;
    this.#messageCounter = 0;
    this.#dirty = false;
  }

  #loadRecord(record: AiConversationRecord): void {
    this.#conversationId = record.id;
    this.#title = record.title;
    this.#createdAt = record.createdAt;
    this.#status = record.status;
    this.#pending = false;
    this.#errorMessage = record.errorMessage;
    this.#dirty = false;

    this.#messages.length = 0;
    this.#messageIndexById.clear();
    const messages = this.#parseMessages(record.messagesJson);
    for (const message of messages) {
      this.#messages.push(message);
      this.#messageIndexById.set(message.id, this.#messages.length - 1);
    }
    this.#messageCounter = this.#nextMessageCounter(messages);

    this.#history.length = 0;
    this.#history.push(...this.#parseHistory(record.historyJson));
    this.#pendingToolBatch = this.#parsePendingToolBatch(record.pendingToolBatchJson);
    if (this.#pendingToolBatch !== null && this.#pendingToolBatch.pendingInputs.length > 0) {
      void this.#awaitPendingInputs(this.#pendingToolBatch);
    }
  }

  #assertIdleForConversationSwitch(action: string): void {
    if (this.#pending) {
      throw new Error(`AI 请求仍在处理中，暂时不能${action}会话。`);
    }
    if (this.#pendingToolBatch !== null) {
      throw new Error(`AI 正在等待当前工具步骤的用户回答，暂时不能${action}会话。`);
    }
  }

  #createSnapshot(): AiChatSnapshot {
    return {
      conversationId: this.#conversationId,
      adapterKind: AI_ADAPTER_KIND,
      model: AI_MODEL,
      messages: this.#messages.map(cloneAiChatMessage),
      pending: this.#pending,
      pendingUserInputs: this.#pendingToolBatch
        ? this.#pendingToolBatch.pendingInputs.map((input) => input.handle)
        : [],
      errorMessage: this.#errorMessage,
    };
  }

  #emitSnapshot(): void {
    this.#publisher.emit({
      kind: "snapshot",
      snapshot: this.#createSnapshot(),
    });
  }

  #persistIfNeeded(): void {
    if (!this.#dirty) {
      return;
    }
    // Empty pure drafts are not written until they have content or error state.
    if (
      this.#messages.length === 0 &&
      this.#pendingToolBatch === null &&
      this.#errorMessage === null
    ) {
      this.#dirty = false;
      return;
    }
    if (this.#conversationId === "") {
      this.#conversationId = randomUUID();
      this.#createdAt = Date.now();
    }

    const now = Date.now();
    const title = this.#deriveTitle();
    this.#title = title;
    const record: AiConversationRecord = {
      id: this.#conversationId,
      projectId: this.#projectId,
      title,
      status: this.#status,
      createdAt: this.#createdAt || now,
      updatedAt: now,
      lastActiveAt: now,
      adapterKind: AI_ADAPTER_KIND,
      model: AI_MODEL,
      messagesJson: JSON.stringify(this.#messages.map(cloneAiChatMessage)),
      historyJson: JSON.stringify(this.#history),
      pendingToolBatchJson: this.#serializePendingToolBatch(this.#pendingToolBatch),
      errorMessage: this.#errorMessage,
    };
    this.#repository.upsert(record);
    this.#createdAt = record.createdAt;
    this.#dirty = false;
  }

  #markDirty(): void {
    this.#dirty = true;
  }

  #deriveTitle(): string {
    const firstUser = this.#messages.find((message) => message.role === "user");
    if (!firstUser || firstUser.role !== "user") {
      return this.#title || EMPTY_TITLE;
    }
    const text = firstUser.text.trim().replace(/\s+/g, " ");
    if (text === "") {
      return EMPTY_TITLE;
    }
    return text.length > TITLE_MAX_LENGTH ? `${text.slice(0, TITLE_MAX_LENGTH)}…` : text;
  }

  #nextMessageCounter(messages: readonly AiChatMessage[]): number {
    let max = -1;
    for (const message of messages) {
      const match = /^ai-chat-(\d+)$/.exec(message.id);
      if (match) {
        max = Math.max(max, Number(match[1]));
      }
    }
    return max + 1;
  }

  #parseMessages(json: string): AiChatMessage[] {
    try {
      const parsed = JSON.parse(json) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed as AiChatMessage[];
    } catch {
      return [];
    }
  }

  #parseHistory(json: string): InputItem[] {
    try {
      const parsed = JSON.parse(json) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed as InputItem[];
    } catch {
      return [];
    }
  }

  #parsePendingToolBatch(json: string | null): PendingToolBatch | null {
    if (json === null || json === "") {
      return null;
    }
    try {
      const parsed = JSON.parse(json) as SerializedPendingToolBatch;
      const resolvedResultsByCallId = new Map(parsed.resolvedResultsByCallId);
      const pendingInputs = parsed.pendingInputs.map((entry) =>
        this.#rebuildPendingUserInput(entry.callId, entry.serializable),
      );
      return {
        assistantMessageId: parsed.assistantMessageId,
        calls: parsed.calls,
        input: parsed.input,
        transcript: parsed.transcript,
        resolvedResultsByCallId,
        pendingInputs,
      };
    } catch {
      return null;
    }
  }

  /**
   * 从纯数据形式重建一个等待用户输入的 entry：新建 resolver 与 handle，
   * 并挂上 `#awaitPendingInputs` 的续接，使重开 app 后用户仍可回答。
   */
  #rebuildPendingUserInput(
    callId: string,
    serializable: { toolName: string; args: unknown },
  ): PendingUserInput {
    let resolve!: (result: ToolResultItem) => void;
    const resolverPromise = new Promise<ToolResultItem>((res) => {
      resolve = res;
    });
    const handle = this.#createHandleFromSerializable(callId, serializable, { resolve });
    return { callId, handle, resolverPromise, resolve, serializable };
  }

  /** 根据 serializable 的 toolName 分派到对应 handle 工厂。 */
  #createHandleFromSerializable(
    callId: string,
    serializable: { toolName: string; args: unknown },
    resolver: { resolve: (result: ToolResultItem) => void },
  ): AiChatUserInputHandle {
    if (serializable.toolName === "ask_user") {
      const args = parseAskUserArgs({
        type: "tool_call",
        id: callId,
        name: "ask_user",
        argumentsText: JSON.stringify(serializable.args),
        argumentsJson: serializable.args,
      });
      return new AskUserRequestHandleImpl(
        {
          type: "tool_call",
          id: callId,
          name: "ask_user",
          argumentsText: JSON.stringify(serializable.args),
          argumentsJson: serializable.args,
        },
        args,
        resolver,
      );
    }
    throw new Error(`无法重建未知工具的用户输入 handle: ${serializable.toolName}`);
  }

  #serializePendingToolBatch(batch: PendingToolBatch | null): string | null {
    if (batch === null) {
      return null;
    }
    const payload: SerializedPendingToolBatch = {
      assistantMessageId: batch.assistantMessageId,
      calls: batch.calls,
      input: batch.input,
      transcript: batch.transcript,
      resolvedResultsByCallId: [...batch.resolvedResultsByCallId.entries()],
      pendingInputs: batch.pendingInputs.map((input) => ({
        callId: input.callId,
        serializable: input.serializable,
      })),
    };
    return JSON.stringify(payload);
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
          this.#markDirty();
          this.#persistIfNeeded();
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
            pendingUserInputs: [],
          },
        },
      ]);
      this.#markDirty();
      this.#persistIfNeeded();
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
          pendingUserInputs: [],
          errorMessage: this.#errorMessage,
        },
      });
      this.#emitDelta(ops);
      this.#markDirty();
      this.#persistIfNeeded();
    }
  }

  async #processToolBatch(
    assistantMessageId: string,
    calls: ToolCallItem[],
    input: InputItem[],
    transcript: InputItem[],
  ): Promise<"continue" | "paused"> {
    const resolvedResultsByCallId = new Map<string, ToolResultItem>();
    const pendingInputs: PendingUserInput[] = [];

    for (const call of calls) {
      this.#emitAssistantPartUpdate(assistantMessageId, call.id, {
        status: "running",
      });

      const execution = await this.#toolRunner.execute(call);
      if (execution.userInputRequest) {
        const req: UserInputRequest = execution.userInputRequest;
        let resolve!: (result: ToolResultItem) => void;
        const resolverPromise = new Promise<ToolResultItem>((res) => {
          resolve = res;
        });
        const handle = req.createHandle({ resolve });
        this.#emitAssistantPartUpdate(assistantMessageId, call.id, {
          status: "awaiting_user",
          resultText: null,
          errorMessage: null,
        });
        pendingInputs.push({
          callId: call.id,
          handle,
          resolverPromise,
          resolve,
          serializable: req.serializable,
        });
        continue;
      }

      this.#emitAssistantPartUpdate(assistantMessageId, call.id, {
        status: execution.errorMessage === null ? "complete" : "error",
        resultText: execution.resultText,
        errorMessage: execution.errorMessage,
      });
      resolvedResultsByCallId.set(call.id, execution.toolResult);
    }

    if (pendingInputs.length > 0) {
      this.#pending = false;
      const batch: PendingToolBatch = {
        assistantMessageId,
        calls,
        input: [...input],
        transcript: [...transcript],
        resolvedResultsByCallId,
        pendingInputs,
      };
      this.#pendingToolBatch = batch;
      this.#emitDelta([
        {
          type: "state.updated",
          patch: {
            pending: false,
            pendingUserInputs: pendingInputs.map((entry) => entry.handle),
            errorMessage: null,
          },
        },
      ]);
      void this.#awaitPendingInputs(batch);
      return "paused";
    }

    for (const call of calls) {
      const result = resolvedResultsByCallId.get(call.id);
      if (!result) {
        continue;
      }
      input.push(result);
      transcript.push(result);
    }

    return "continue";
  }

  /**
   * 等待 batch 中所有 pending input 的 resolver 被客户端 handle 调用 resolve。
   * 全部完成后将结果并入 input/transcript，继续下一轮 AI 请求。
   */
  async #awaitPendingInputs(batch: PendingToolBatch): Promise<void> {
    const results = await Promise.all(batch.pendingInputs.map((entry) => entry.resolverPromise));

    // 会话已切换/重置/dispose，丢弃此续接。
    if (this.#pendingToolBatch !== batch || this.#disposed) {
      return;
    }

    for (let i = 0; i < batch.pendingInputs.length; i++) {
      const entry = batch.pendingInputs[i]!;
      const result = results[i]!;
      batch.resolvedResultsByCallId.set(entry.callId, result);
      this.#emitAssistantPartUpdate(batch.assistantMessageId, entry.callId, {
        status: "complete",
        resultText: this.#toolResultToText(result),
        errorMessage: null,
      });
    }

    const input = [...batch.input];
    const transcript = [...batch.transcript];
    for (const call of batch.calls) {
      const result = batch.resolvedResultsByCallId.get(call.id);
      if (!result) {
        throw new Error(`工具 ${call.id} 缺少执行结果。`);
      }
      input.push(result);
      transcript.push(result);
    }

    const assistantMessageId = batch.assistantMessageId;
    this.#pendingToolBatch = null;
    this.#pending = true;
    this.#emitDelta([
      {
        type: "state.updated",
        patch: {
          pending: true,
          pendingUserInputs: [],
          errorMessage: null,
        },
      },
    ]);
    this.#markDirty();
    this.#persistIfNeeded();

    void this.#runRequest({
      assistantMessageId,
      requestInput: input,
      transcript,
    });
  }

  /** 从 ToolResultItem 的 content 提取可展示文本。 */
  #toolResultToText(result: ToolResultItem): string {
    return result.content
      .map((block) => {
        switch (block.type) {
          case "text":
            return block.text;
          case "json":
            return JSON.stringify(block.json, null, 2);
          case "image":
            return `[图片] ${block.imageUrl}`;
          case "binary_ref":
            return `[二进制引用] ${block.ref}`;
          case "opaque":
            return "[私有内容]";
        }
      })
      .filter((text) => text !== "")
      .join("\n\n");
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
