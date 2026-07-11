import { randomUUID } from "node:crypto";

import type { AIResponse, AIStreamEvent, InputItem, OutputItem } from "@codehz/ai";

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
  AiChatMessage,
  AiChatMessagePatch,
  AiChatSnapshot,
  AiChatToolCall,
  AiChatUserMessage,
  AiConversationActivity,
  AiConversationSummary,
} from "#shared/rpc/ai-rpc";

import type { AiChatRepository, AiConversationRecord } from "../../db/repositories/ai-chat-repo";
import { joinContentBlocksText, toMessageUsage } from "../ai-utils";
import { AI_ADAPTER_KIND, AI_MODEL } from "../mock-adapter";
import {
  parsePendingToolBatch,
  serializePendingToolBatch,
  type PendingToolBatch,
} from "./pending-tool-batch";

const EMPTY_TITLE = "新会话";
const TITLE_MAX_LENGTH = 40;

type AiConversationStateOptions = {
  projectId: number;
  repository: AiChatRepository;
  record?: AiConversationRecord | null;
};

function applyToolCallStatusPatch(
  current: AiChatToolCall["status"],
  patch: AiChatAssistantPartPatch["status"],
): AiChatToolCall["status"] {
  if (
    patch === "pending" ||
    patch === "running" ||
    patch === "awaiting_user" ||
    patch === "complete" ||
    patch === "error"
  ) {
    return patch;
  }
  return current;
}

export function recordToConversationActivity(record: AiConversationRecord): AiConversationActivity {
  return record.pendingToolBatchJson ? "awaiting_user" : "idle";
}

export function recordToConversationSummary(record: AiConversationRecord): AiConversationSummary {
  return {
    id: record.id,
    title: record.title,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastActiveAt: record.lastActiveAt,
    activity: recordToConversationActivity(record),
    persisted: true,
  };
}

export class AiConversationState {
  readonly #projectId: number;
  readonly #repository: AiChatRepository;
  readonly #messages: AiChatMessage[] = [];
  readonly #messageIndexById = new Map<string, number>();
  readonly #history: InputItem[] = [];
  #conversationId = "";
  #title = EMPTY_TITLE;
  #createdAt = 0;
  #updatedAt = 0;
  #lastActiveAt = 0;
  #status: "active" | "archived" = "active";
  #pendingToolBatch: PendingToolBatch | null = null;
  #pending = false;
  #errorMessage: string | null = null;
  #messageCounter = 0;
  #dirty = false;
  #persisted = false;

  constructor(options: AiConversationStateOptions) {
    this.#projectId = options.projectId;
    this.#repository = options.repository;
    if (options.record) {
      this.#loadRecord(options.record);
      return;
    }
    this.#beginEmptyConversation();
  }

  get conversationId(): string {
    return this.#conversationId;
  }

  get persisted(): boolean {
    return this.#persisted;
  }

  get pending(): boolean {
    return this.#pending;
  }

  get pendingToolBatch(): PendingToolBatch | null {
    return this.#pendingToolBatch;
  }

  get history(): readonly InputItem[] {
    return this.#history;
  }

  get isPureDraft(): boolean {
    return (
      this.#messages.length === 0 && this.#pendingToolBatch === null && this.#errorMessage === null
    );
  }

  getSnapshot(): AiChatSnapshot {
    return {
      conversationId: this.#conversationId,
      adapterKind: AI_ADAPTER_KIND,
      model: AI_MODEL,
      messages: this.#messages.map(cloneAiChatMessage),
      pending: this.#pending,
      pendingUserInputs: this.#pendingToolBatch
        ? this.#pendingToolBatch.pendingInputs.map((input) => input.pending)
        : [],
      errorMessage: this.#errorMessage,
    };
  }

  getSummary(): AiConversationSummary {
    return {
      id: this.#conversationId,
      title: this.#deriveTitle(),
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
      lastActiveAt: this.#lastActiveAt,
      activity: this.#activity,
      persisted: this.#persisted,
    };
  }

  touchLastActive(): void {
    this.#markDirty();
  }

  persistIfNeeded(): void {
    if (!this.#dirty) {
      return;
    }

    if (this.isPureDraft) {
      this.#dirty = false;
      this.#persisted = false;
      return;
    }

    const now = Date.now();
    if (this.#conversationId === "") {
      this.#conversationId = randomUUID();
    }
    if (this.#createdAt === 0) {
      this.#createdAt = now;
    }
    if (this.#updatedAt === 0) {
      this.#updatedAt = now;
    }
    if (this.#lastActiveAt === 0) {
      this.#lastActiveAt = now;
    }

    const title = this.#deriveTitle();
    this.#title = title;
    const record: AiConversationRecord = {
      id: this.#conversationId,
      projectId: this.#projectId,
      title,
      status: this.#status,
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
      lastActiveAt: this.#lastActiveAt,
      adapterKind: AI_ADAPTER_KIND,
      model: AI_MODEL,
      messagesJson: JSON.stringify(this.#messages.map(cloneAiChatMessage)),
      historyJson: JSON.stringify(this.#history),
      pendingToolBatchJson: serializePendingToolBatch(this.#pendingToolBatch),
      errorMessage: this.#errorMessage,
    };
    this.#repository.upsert(record);
    this.#persisted = true;
    this.#dirty = false;
  }

  setPending(pending: boolean): void {
    this.#pending = pending;
    this.#markDirty();
  }

  setPendingToolBatch(batch: PendingToolBatch | null): void {
    this.#pendingToolBatch = batch;
    this.#markDirty();
  }

  setErrorMessage(errorMessage: string | null): void {
    this.#errorMessage = errorMessage;
    this.#markDirty();
  }

  replaceHistory(history: readonly InputItem[]): void {
    this.#history.length = 0;
    this.#history.push(...history);
    this.#markDirty();
  }

  appendUserMessage(text: string): AiChatUserMessage {
    const message: AiChatUserMessage = {
      id: `ai-chat-${this.#messageCounter++}`,
      role: "user",
      text,
      status: "complete",
    };
    this.#messages.push(message);
    this.#messageIndexById.set(message.id, this.#messages.length - 1);
    this.#markDirty();
    return message;
  }

  appendAssistantMessage(): AiChatAssistantMessage {
    const message: AiChatAssistantMessage = {
      id: `ai-chat-${this.#messageCounter++}`,
      role: "assistant",
      status: "streaming",
      usage: null,
      parts: [],
    };
    this.#messages.push(message);
    this.#messageIndexById.set(message.id, this.#messages.length - 1);
    this.#markDirty();
    return message;
  }

  updateMessage(messageId: string, patch: AiChatMessagePatch): AiChatDeltaOp[] {
    if (this.#patchMessage(messageId, patch) === null) {
      return [];
    }

    return [
      {
        type: "message.updated",
        messageId,
        patch: cloneAiChatMessagePatch(patch),
      },
    ];
  }

  removeMessage(messageId: string): AiChatDeltaOp[] {
    if (!this.#removeMessage(messageId)) {
      return [];
    }

    return [
      {
        type: "message.removed",
        messageId,
      },
    ];
  }

  countAssistantParts(messageId: string): number {
    return this.#getAssistantMessage(messageId)?.parts.length ?? 0;
  }

  updateAssistantPart(
    messageId: string,
    partId: string,
    patch: AiChatAssistantPartPatch,
  ): AiChatDeltaOp[] {
    if (this.#patchAssistantPart(messageId, partId, patch) === null) {
      return [];
    }

    return [
      {
        type: "assistant_part.updated",
        messageId,
        partId,
        patch: cloneAiChatAssistantPartPatch(patch),
      },
    ];
  }

  completeStreamingAssistantParts(messageId: string): AiChatDeltaOp[] {
    const message = this.#getAssistantMessage(messageId);
    if (!message) {
      return [];
    }

    const ops: AiChatDeltaOp[] = [];
    for (const part of message.parts) {
      if ((part.type === "message" || part.type === "reasoning") && part.status !== "complete") {
        part.status = "complete";
        this.#markDirty();
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
    return ops;
  }

  reconcileAssistantResponse(
    messageId: string,
    streamStartPartCount: number,
    response: AIResponse,
  ): AiChatDeltaOp[] {
    const message = this.#getAssistantMessage(messageId);
    if (!message) {
      return [];
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

    const ops: AiChatDeltaOp[] = [];
    for (let i = 0; i < canonicalParts.length; i++) {
      const canonical = canonicalParts[i]!;
      const current = message.parts[streamStartPartCount + i];

      if (!current) {
        message.parts.push(canonical);
        this.#markDirty();
        ops.push({
          type: "assistant_part.added",
          messageId,
          part: cloneAiChatAssistantPart(canonical),
        });
        continue;
      }

      const patch = this.#buildPartPatch(current, canonical);
      if (!patch) {
        continue;
      }
      ops.push(...this.updateAssistantPart(messageId, current.id, patch));
    }

    return ops;
  }

  handleStreamEvent(event: AIStreamEvent, assistantMessageId: string): AiChatDeltaOp[] {
    if (event.type === "message.started") {
      return this.#addAssistantPart(assistantMessageId, {
        id: event.item.id,
        type: "message",
        text: "",
        status: "streaming",
      });
    }

    if (event.type === "message.delta") {
      return this.#appendAssistantPartTextDelta(assistantMessageId, event.itemId, event.delta.text);
    }

    if (event.type === "message.completed") {
      return this.updateAssistantPart(assistantMessageId, event.item.id ?? "", {
        text: joinContentBlocksText(event.item.content),
        status: "complete",
      });
    }

    if (event.type === "reasoning.started") {
      return this.#addAssistantPart(assistantMessageId, {
        id: event.item.id,
        type: "reasoning",
        text: "",
        visibility: event.item.visibility,
        status: "streaming",
      });
    }

    if (event.type === "reasoning.delta") {
      const deltaText = joinContentBlocksText([event.delta]);
      if (deltaText === "") {
        return [];
      }
      return this.#appendAssistantPartTextDelta(assistantMessageId, event.itemId, deltaText);
    }

    if (event.type === "reasoning.completed") {
      return this.updateAssistantPart(assistantMessageId, event.item.id ?? "", {
        text: joinContentBlocksText(event.item.content),
        visibility: event.item.visibility,
        status: "complete",
      });
    }

    if (event.type === "tool_call.started") {
      return this.#addAssistantPart(assistantMessageId, {
        id: event.item.id,
        type: "tool_call",
        name: event.item.name,
        argumentsText: "",
        status: "pending",
        resultText: null,
        errorMessage: null,
      });
    }

    if (event.type === "tool_call.delta") {
      const toolCall = this.#getToolCall(assistantMessageId, event.itemId);
      if (!toolCall) {
        return [];
      }

      return this.updateAssistantPart(assistantMessageId, event.itemId, {
        argumentsText: `${toolCall.argumentsText}${event.delta.argumentsText ?? ""}`,
      });
    }

    if (event.type === "tool_call.completed") {
      return this.updateAssistantPart(assistantMessageId, event.item.id, {
        argumentsText: event.item.argumentsText,
      });
    }

    return [];
  }

  buildCompletionPatch(response: AIResponse): AiChatMessagePatch {
    return {
      status: "complete",
      usage: toMessageUsage(response.usage),
    };
  }

  #beginEmptyConversation(): void {
    const now = Date.now();
    this.#conversationId = randomUUID();
    this.#title = EMPTY_TITLE;
    this.#createdAt = now;
    this.#updatedAt = now;
    this.#lastActiveAt = now;
    this.#status = "active";
    this.#messages.length = 0;
    this.#messageIndexById.clear();
    this.#history.length = 0;
    this.#pendingToolBatch = null;
    this.#pending = false;
    this.#errorMessage = null;
    this.#messageCounter = 0;
    this.#dirty = false;
    this.#persisted = false;
  }

  #loadRecord(record: AiConversationRecord): void {
    this.#conversationId = record.id;
    this.#title = record.title;
    this.#createdAt = record.createdAt;
    this.#updatedAt = record.updatedAt;
    this.#lastActiveAt = record.lastActiveAt;
    this.#status = record.status;
    this.#pending = false;
    this.#errorMessage = record.errorMessage;
    this.#dirty = false;
    this.#persisted = true;

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
    this.#pendingToolBatch = parsePendingToolBatch(record.pendingToolBatchJson);
  }

  get #activity(): AiConversationActivity {
    if (this.#pendingToolBatch !== null) {
      return "awaiting_user";
    }
    if (this.#pending) {
      return "streaming";
    }
    return "idle";
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

  #markDirty(): void {
    this.#dirty = true;
    const now = Date.now();
    if (this.#createdAt === 0) {
      this.#createdAt = now;
    }
    this.#updatedAt = now;
    this.#lastActiveAt = now;
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
    this.#markDirty();
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
    this.#markDirty();
    return true;
  }

  #addAssistantPart(messageId: string, part: AiChatAssistantPart): AiChatDeltaOp[] {
    const message = this.#getAssistantMessage(messageId);
    if (!message) {
      return [];
    }

    message.parts.push(part);
    this.#markDirty();
    return [
      {
        type: "assistant_part.added",
        messageId,
        part: cloneAiChatAssistantPart(part),
      },
    ];
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
          status: applyToolCallStatusPatch(current.status, patch.status),
          resultText: patch.resultText !== undefined ? patch.resultText : current.resultText,
          errorMessage:
            patch.errorMessage !== undefined ? patch.errorMessage : current.errorMessage,
        };
        break;
    }

    message.parts[index] = next;
    this.#markDirty();
    return next;
  }

  #appendAssistantPartTextDelta(messageId: string, partId: string, text: string): AiChatDeltaOp[] {
    const message = this.#getAssistantMessage(messageId);
    if (!message || text === "") {
      return [];
    }

    const part = message.parts.find((candidate) => candidate.id === partId);
    if (!part || part.type === "tool_call") {
      return [];
    }

    part.text += text;
    this.#markDirty();
    return [
      {
        type: "assistant_part.text.delta",
        messageId,
        partId,
        text,
      },
    ];
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
        const patch: AiChatAssistantPartPatch = {};
        if (current.text !== canonical.text) {
          patch.text = canonical.text;
        }
        if (current.status !== canonical.status) {
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
}
