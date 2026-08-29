import { randomUUID } from "node:crypto";

import type { AIResponse, AIStreamEvent, InputItem, OutputItem } from "@codehz/ai";

import {
  applyAiChatMessagePatch,
  cloneAiChatAssistantPart,
  cloneAiChatAssistantPartPatch,
  cloneAiChatMessagePatch,
  cloneAiToolView,
} from "#shared/rpc/ai/index";
import type {
  AiChatAssistantMessage,
  AiChatAssistantPart,
  AiChatAssistantPartPatch,
  AiChatDeltaOp,
  AiChatMentionRef,
  AiChatMessage,
  AiChatMessagePatch,
  AiChatSendMessageInput,
  AiChatSlashRef,
  AiChatSnapshot,
  AiChatToolCall,
  AiChatUserMessage,
  AiChatWarning,
  AiConversationActivity,
  AiConversationSummary,
  AiChatSelectableModelKind,
} from "#shared/rpc/ai/index";
import {
  BUILTIN_AI_AGENT_ID,
  isAiReasoningLevel,
  type AiReasoningLevel,
} from "#shared/rpc/services/index";

import type {
  AiChatRepository,
  AiConversationRecord,
  AiConversationStatus,
  AiConversationSummaryRecord,
} from "../../db/repositories/ai-chat-repo";
import { contentBlockToDisplayText, joinContentBlocksText } from "../ai-utils";
import {
  addChildNode,
  concatActiveHistory,
  createEmptyConversationTree,
  distributeHistoryToActivePath,
  getPathLeaf,
  listAllMessages,
  parseConversationMessagesJson,
  projectActiveMessages,
  projectActivePath,
  selectSiblingByIndex,
  serializeConversationTree,
  type ConversationTree,
} from "./conversation-tree";
import {
  parsePendingToolBatch,
  serializePendingToolBatch,
  type PendingToolBatch,
} from "./pending-tool-batch";
import { rebuildFromLastUserMessage, rebuildLastRequestInput } from "./request-history";
import { formatUserMessageDisplay } from "./slash-expand";

const EMPTY_TITLE = "新会话";
const TITLE_MAX_LENGTH = 40;

function toAdapterKind(value: string): AiChatSelectableModelKind {
  switch (value) {
    case "responses":
    case "chat-completions":
    case "delta-completions":
    case "messages":
    case "ollama":
    case "gemini":
    case "mock":
      return value;
    default:
      return "mock";
  }
}

type AiConversationStateOptions = {
  projectId: number;
  repository: AiChatRepository;
  record?: AiConversationRecord | null;
  adapterKind: AiChatSelectableModelKind;
  model: string;
  selectedModelId: string;
  selectedAgentId: string;
  /** Initial session reasoning effort (new conversations / overrides). */
  selectedReasoningLevel?: AiReasoningLevel | null;
  scenarioId: string | null;
  persistence: "persistent" | "ephemeral";
};

function parseStoredReasoningLevel(value: string | null | undefined): AiReasoningLevel | null {
  if (value == null) {
    return null;
  }
  const normalized = value.trim();
  if (normalized === "" || !isAiReasoningLevel(normalized)) {
    return null;
  }
  return normalized;
}

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

const WARNING_ID_PREFIX_PATTERN = /^(.*)-warning-\d+$/;

function normalizeStoredWarning(entry: unknown): AiChatWarning {
  const raw = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
  const id = typeof raw.id === "string" ? raw.id : randomUUID();
  const message = typeof raw.message === "string" ? raw.message : "";
  const code = typeof raw.code === "string" ? raw.code : null;
  let messageId = typeof raw.messageId === "string" ? raw.messageId : "";
  if (messageId === "") {
    const match = WARNING_ID_PREFIX_PATTERN.exec(id);
    if (match?.[1]) {
      messageId = match[1];
    }
  }
  return { id, messageId, message, code };
}

function normalizeStoredSlash(value: unknown): AiChatSlashRef | null {
  if (value == null || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.promptId !== "string" ||
    typeof raw.slug !== "string" ||
    typeof raw.title !== "string" ||
    typeof raw.body !== "string"
  ) {
    return null;
  }
  return {
    promptId: raw.promptId,
    slug: raw.slug,
    title: raw.title,
    body: raw.body,
  };
}

function normalizeStoredMention(value: unknown): AiChatMentionRef | null {
  if (value == null || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (
    (raw.domain !== "manuscript" && raw.domain !== "resource") ||
    typeof raw.id !== "string" ||
    (raw.kind !== "folder" && raw.kind !== "chapter" && raw.kind !== "file") ||
    typeof raw.label !== "string" ||
    typeof raw.displayPath !== "string" ||
    typeof raw.token !== "string"
  ) {
    return null;
  }
  return {
    domain: raw.domain,
    id: raw.id,
    kind: raw.kind,
    label: raw.label,
    displayPath: raw.displayPath,
    token: raw.token,
  };
}

function normalizeStoredMentions(value: unknown): AiChatMentionRef[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const mentions: AiChatMentionRef[] = [];
  for (const entry of value) {
    const mention = normalizeStoredMention(entry);
    if (mention) {
      mentions.push(mention);
    }
  }
  return mentions;
}

/** Prototype-safe hydrate: legacy user rows without `slash`/`mentions` get defaults. */
function normalizeStoredMessage(entry: unknown): AiChatMessage {
  if (entry == null || typeof entry !== "object") {
    return {
      id: `ai-chat-legacy-${randomUUID()}`,
      role: "user",
      text: "",
      slash: null,
      mentions: [],
      status: "complete",
    };
  }
  const raw = entry as Record<string, unknown>;
  if (raw.role === "assistant") {
    const message = entry as AiChatAssistantMessage;
    return {
      ...message,
      modelName: typeof raw.modelName === "string" ? raw.modelName : "",
    };
  }
  return {
    id: typeof raw.id === "string" ? raw.id : `ai-chat-legacy-${randomUUID()}`,
    role: "user",
    text: typeof raw.text === "string" ? raw.text : "",
    slash: normalizeStoredSlash(raw.slash),
    mentions: normalizeStoredMentions(raw.mentions),
    status: "complete",
  };
}

export function recordToConversationActivity(
  record: Pick<AiConversationRecord, "pendingToolBatchJson"> | AiConversationSummaryRecord,
): AiConversationActivity {
  if ("pendingToolBatchJson" in record) {
    return record.pendingToolBatchJson ? "awaiting_user" : "idle";
  }
  return record.hasPendingToolBatch ? "awaiting_user" : "idle";
}

export function recordToConversationSummary(
  record: AiConversationRecord | AiConversationSummaryRecord,
): AiConversationSummary {
  return {
    id: record.id,
    title: record.title,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    activity: recordToConversationActivity(record),
    persisted: true,
    scenarioId: record.scenarioId,
    status: record.status,
  };
}

export class AiConversationState {
  readonly #projectId: number;
  readonly #repository: AiChatRepository;
  #adapterKind: AiChatSelectableModelKind;
  #model: string;
  readonly #scenarioId: string | null;
  readonly #persistence: "persistent" | "ephemeral";
  /** Authoritative in-conversation message tree (active path is a projection). */
  #tree: ConversationTree = createEmptyConversationTree();
  readonly #warnings: AiChatWarning[] = [];
  #conversationId = "";
  #title = EMPTY_TITLE;
  #createdAt = 0;
  #updatedAt = 0;
  #status: AiConversationStatus = "active";
  #selectedModelId = "";
  #selectedAgentId: string = BUILTIN_AI_AGENT_ID;
  #selectedReasoningLevel: AiReasoningLevel | null = null;
  #pendingToolBatch: PendingToolBatch | null = null;
  #pending = false;
  #errorMessage: string | null = null;
  /**
   * Assistant message id eligible for in-place continue after stop/fail.
   * `canContinue` is true only when the active leaf matches this id.
   */
  #continueAssistantId: string | null = null;
  #messageCounter = 0;
  #dirty = false;
  #persisted = false;
  #titleCustomized = false;
  #discarded = false;

  constructor(options: AiConversationStateOptions) {
    this.#projectId = options.projectId;
    this.#repository = options.repository;
    this.#adapterKind = options.adapterKind;
    this.#model = options.model;
    this.#scenarioId = options.scenarioId;
    this.#persistence = options.persistence;
    this.#selectedModelId = options.selectedModelId;
    this.#selectedAgentId = options.selectedAgentId;
    this.#selectedReasoningLevel = options.selectedReasoningLevel ?? null;
    if (options.record) {
      this.#loadRecord(options.record);
      // Prefer explicit constructor override (e.g. model default after invalid stored value).
      if (options.selectedReasoningLevel !== undefined) {
        this.#selectedReasoningLevel = options.selectedReasoningLevel;
      }
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

  get persistence(): "persistent" | "ephemeral" {
    return this.#persistence;
  }

  get pending(): boolean {
    return this.#pending;
  }

  get pendingToolBatch(): PendingToolBatch | null {
    return this.#pendingToolBatch;
  }

  get history(): readonly InputItem[] {
    return concatActiveHistory(this.#tree);
  }

  /** Authoritative conversation tree (mutation via state methods only). */
  get tree(): ConversationTree {
    return this.#tree;
  }

  get errorMessage(): string | null {
    return this.#errorMessage;
  }

  get isPureDraft(): boolean {
    return (
      this.#tree.nodes.size === 0 && this.#pendingToolBatch === null && this.#errorMessage === null
    );
  }

  /** Last assistant message on the active path, if any. */
  get lastAssistantMessage(): AiChatAssistantMessage | null {
    const path = projectActivePath(this.#tree);
    for (let index = path.length - 1; index >= 0; index--) {
      const message = path[index]!.message;
      if (message.role === "assistant") {
        return message;
      }
    }
    return null;
  }

  get selectedModelId(): string {
    return this.#selectedModelId;
  }

  get selectedAgentId(): string {
    return this.#selectedAgentId;
  }

  get selectedReasoningLevel(): AiReasoningLevel | null {
    return this.#selectedReasoningLevel;
  }

  getSnapshot(): AiChatSnapshot {
    return {
      conversationId: this.#conversationId,
      adapterKind: this.#adapterKind,
      model: this.#model,
      selectedModelId: this.#selectedModelId,
      selectedAgentId: this.#selectedAgentId,
      selectedReasoningLevel: this.#selectedReasoningLevel,
      scenarioId: this.#scenarioId,
      warnings: this.#warnings.map((warning) => ({ ...warning })),
      messages: projectActiveMessages(this.#tree),
      pending: this.#pending,
      openInteractions: this.#pendingToolBatch
        ? this.#pendingToolBatch.pendingInputs
            .filter((input) => !input.settled)
            .map((input) => input.view)
        : [],
      errorMessage: this.#errorMessage,
      canRetry: this.canRetry,
      canContinue: this.canContinue,
    };
  }

  /**
   * Idle + not awaiting user + path leaf is assistant + history can rebuild from last user.
   * Used for sibling regenerate (retryLastRequest), not same-node overwrite.
   */
  get canRetry(): boolean {
    if (this.#pending || this.#pendingToolBatch !== null) {
      return false;
    }
    const leaf = getPathLeaf(this.#tree);
    if (!leaf || leaf.role !== "assistant") {
      return false;
    }
    return rebuildFromLastUserMessage(this.history).length > 0;
  }

  /**
   * Idle + active leaf is the marked interrupted/failed assistant + last-request input rebuilds.
   * Used for same-node continue (continueLastRequest).
   */
  get canContinue(): boolean {
    if (this.#pending || this.#pendingToolBatch !== null) {
      return false;
    }
    if (this.#continueAssistantId === null) {
      return false;
    }
    const leaf = getPathLeaf(this.#tree);
    if (!leaf || leaf.role !== "assistant" || leaf.id !== this.#continueAssistantId) {
      return false;
    }
    return rebuildLastRequestInput(this.history).length > 0;
  }

  get continueAssistantId(): string | null {
    return this.#continueAssistantId;
  }

  get status(): AiConversationStatus {
    return this.#status;
  }

  get titleCustomized(): boolean {
    return this.#titleCustomized;
  }

  getSummary(): AiConversationSummary {
    return {
      id: this.#conversationId,
      title: this.#deriveTitle(),
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
      activity: this.#activity,
      persisted: this.#persisted,
      scenarioId: this.#scenarioId,
      status: this.#status,
    };
  }

  /** Collect plain-text message bodies for in-memory search / snippet extraction (full tree). */
  collectSearchableTexts(): string[] {
    const texts: string[] = [];
    for (const message of listAllMessages(this.#tree)) {
      if (message.role === "user") {
        const text = formatUserMessageDisplay(message.slash, message.text).trim();
        if (text !== "") {
          texts.push(text);
        }
        continue;
      }
      for (const part of message.parts) {
        if (part.type === "message" || part.type === "reasoning") {
          const text = part.text.trim();
          if (text !== "") {
            texts.push(text);
          }
        }
      }
    }
    return texts;
  }

  /** Skip future persists (used before hard-delete dispose). */
  discard(): void {
    this.#discarded = true;
    this.#dirty = false;
  }

  rename(title: string): void {
    const normalized = title.trim().replace(/\s+/g, " ");
    if (normalized === "") {
      throw new Error("会话标题不能为空。");
    }
    this.#title =
      normalized.length > TITLE_MAX_LENGTH
        ? `${normalized.slice(0, TITLE_MAX_LENGTH)}…`
        : normalized;
    this.#titleCustomized = true;
    this.#markDirty();
    this.persistIfNeeded();
  }

  setStatus(status: AiConversationStatus): void {
    if (this.#status === status) {
      return;
    }
    this.#status = status;
    this.#markDirty();
    this.persistIfNeeded();
  }

  persistIfNeeded(): void {
    if (this.#discarded || !this.#dirty) {
      return;
    }

    if (this.#persistence === "ephemeral") {
      this.#dirty = false;
      this.#persisted = false;
      return;
    }

    if (this.isPureDraft && this.#status === "active") {
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

    const title = this.#deriveTitle();
    this.#title = title;
    const record: AiConversationRecord = {
      id: this.#conversationId,
      projectId: this.#projectId,
      title,
      titleCustomized: this.#titleCustomized,
      status: this.#status,
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
      adapterKind: this.#adapterKind,
      model: this.#model,
      selectedModelId: this.#selectedModelId,
      selectedAgentId: this.#selectedAgentId,
      selectedReasoningLevel: this.#selectedReasoningLevel,
      scenarioId: this.#scenarioId,
      // v2 tree document is authoritative; history_json mirrors active-path concat for debug/fallback.
      messagesJson: JSON.stringify(serializeConversationTree(this.#tree)),
      historyJson: JSON.stringify(concatActiveHistory(this.#tree)),
      pendingToolBatchJson: serializePendingToolBatch(this.#pendingToolBatch),
      warningsJson: JSON.stringify(this.#warnings),
      errorMessage: this.#errorMessage,
      continueAssistantId: this.#continueAssistantId,
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

  /** Mark which assistant leaf may be continued in-place after stop/fail; null clears. */
  setContinueAssistantId(messageId: string | null): void {
    if (this.#continueAssistantId === messageId) {
      return;
    }
    this.#continueAssistantId = messageId;
    this.#markDirty();
  }

  /** Drop provider warnings attached to a specific assistant message (e.g. before regenerate). */
  clearWarningsForMessage(messageId: string): AiChatDeltaOp[] {
    const remaining = this.#warnings.filter((warning) => warning.messageId !== messageId);
    if (remaining.length === this.#warnings.length) {
      return [];
    }
    this.#warnings.length = 0;
    this.#warnings.push(...remaining);
    this.#markDirty();
    return [
      {
        type: "warnings.cleared_for_message",
        messageId,
      },
    ];
  }

  setSelectedModelId(selectedModelId: string): void {
    if (this.#selectedModelId === selectedModelId) {
      return;
    }
    this.#selectedModelId = selectedModelId;
    this.#markDirty();
  }

  setSelectedAgentId(agentId: string): void {
    if (this.#selectedAgentId === agentId) {
      return;
    }
    this.#selectedAgentId = agentId;
    this.#markDirty();
  }

  setSelectedReasoningLevel(level: AiReasoningLevel | null): void {
    if (this.#selectedReasoningLevel === level) {
      return;
    }
    this.#selectedReasoningLevel = level;
    this.#markDirty();
  }

  setBackend(adapterKind: AiChatSelectableModelKind, model: string): void {
    if (this.#adapterKind === adapterKind && this.#model === model) {
      return;
    }
    this.#adapterKind = adapterKind;
    this.#model = model;
    this.#markDirty();
  }

  /**
   * Rewrite active-path historyItems so their concat equals `history`.
   * Used by send/retry completion paths (same external semantics as linear replace).
   */
  replaceHistory(history: readonly InputItem[]): void {
    distributeHistoryToActivePath(this.#tree, history);
    this.#markDirty();
  }

  /**
   * Select sibling at `index` for the sibling group of `messageId`.
   * Returns false when id/index invalid.
   */
  selectMessageBranch(messageId: string, index: number): boolean {
    const normalized = messageId.trim();
    if (normalized === "" || !Number.isInteger(index) || index < 0) {
      return false;
    }
    if (!selectSiblingByIndex(this.#tree, normalized, index)) {
      return false;
    }
    this.#markDirty();
    return true;
  }

  /**
   * Create a sibling user node under the same parent as `messageId` with new content,
   * select it, and leave path leaf on that user (caller appends assistant + runs request).
   */
  editUserMessage(messageId: string, input: AiChatSendMessageInput): AiChatUserMessage | null {
    const node = this.#tree.nodes.get(messageId.trim());
    if (!node || node.role !== "user") {
      return null;
    }
    const mentions = (input.mentions ?? []).map((mention) => ({ ...mention }));
    const message: AiChatUserMessage = {
      id: `ai-chat-${this.#messageCounter++}`,
      role: "user",
      text: typeof input.text === "string" ? input.text : "",
      slash: input.slash ?? null,
      mentions,
      status: "complete",
    };
    // Sibling of the edited user (same parent); select the new branch.
    addChildNode(this.#tree, node.parentId, message, { select: true });
    this.#markDirty();
    return message;
  }

  /** Active-path projection for path.replaced deltas. */
  projectActivePathMessages(): AiChatMessage[] {
    return projectActiveMessages(this.#tree);
  }

  /**
   * Append a user message as a child of the current path leaf (or as a new root).
   * When the leaf already has children, this creates a sibling branch and selects it.
   */
  appendUserMessage(input: AiChatSendMessageInput): AiChatUserMessage {
    const mentions = (input.mentions ?? []).map((mention) => ({ ...mention }));
    const message: AiChatUserMessage = {
      id: `ai-chat-${this.#messageCounter++}`,
      role: "user",
      text: typeof input.text === "string" ? input.text : "",
      slash: input.slash ?? null,
      mentions,
      status: "complete",
    };
    const path = projectActivePath(this.#tree);
    const leaf = path.length > 0 ? path[path.length - 1]! : null;
    // Normal: parent = assistant leaf. If path ends on user (fork/edit edge), create a sibling user.
    const parentId = leaf == null ? null : leaf.role === "assistant" ? leaf.id : leaf.parentId;
    addChildNode(this.#tree, parentId, message, { select: true });
    this.#markDirty();
    return message;
  }

  /**
   * Append an assistant message under the path leaf user (or create under last user on path).
   * When that user already has children, creates a sibling and selects it.
   */
  appendAssistantMessage(modelName: string): AiChatAssistantMessage {
    const message: AiChatAssistantMessage = {
      id: `ai-chat-${this.#messageCounter++}`,
      role: "assistant",
      status: "streaming",
      modelName,
      usage: null,
      parts: [],
    };
    const path = projectActivePath(this.#tree);
    let parentId: string | null = null;
    for (let index = path.length - 1; index >= 0; index--) {
      if (path[index]!.role === "user") {
        parentId = path[index]!.id;
        break;
      }
    }
    if (parentId === null) {
      throw new Error("无法在没有用户消息的情况下添加助手消息。");
    }
    addChildNode(this.#tree, parentId, message, { select: true });
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

  /**
   * Truncate an assistant message to `keepCount` leading parts (uncommitted tail dropped).
   * No-op when keepCount already covers all parts.
   */
  truncateAssistantParts(messageId: string, keepCount: number): AiChatDeltaOp[] {
    const message = this.#getAssistantMessage(messageId);
    if (!message) {
      return [];
    }
    const nextCount = Math.max(0, Math.min(keepCount, message.parts.length));
    if (nextCount === message.parts.length) {
      return [];
    }
    message.parts.length = nextCount;
    this.#markDirty();
    return [
      {
        type: "assistant_parts.truncated",
        messageId,
        keepCount: nextCount,
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
        item.type === "message" || item.type === "reasoning" || item.type === "tool_call"
          ? this.#findFallbackPart(streamedParts, item.type, usedFallbackIds)
          : null;
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
    if (event.type === "response.warning") {
      const warning: AiChatWarning = {
        id: `${assistantMessageId}-warning-${event.sequence}`,
        messageId: assistantMessageId,
        message: event.message,
        code: event.code ?? null,
      };
      this.#warnings.push(warning);
      this.#markDirty();
      return [{ type: "warning.added", warning: { ...warning } }];
    }

    if (event.type === "message.started") {
      return this.#addAssistantPart(assistantMessageId, {
        id: event.item.id,
        type: "message",
        text: "",
        status: "streaming",
      });
    }

    if (event.type === "message.delta") {
      const deltaText = contentBlockToDisplayText(event.delta);
      if (deltaText === "") {
        return [];
      }
      return this.#appendAssistantPartTextDelta(assistantMessageId, event.itemId, deltaText);
    }

    if (event.type === "message.completed") {
      return this.updateAssistantPart(assistantMessageId, event.itemId, {
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
      const deltaText = contentBlockToDisplayText(event.delta);
      if (deltaText === "") {
        return [];
      }
      return this.#appendAssistantPartTextDelta(assistantMessageId, event.itemId, deltaText);
    }

    if (event.type === "reasoning.completed") {
      return this.updateAssistantPart(assistantMessageId, event.itemId, {
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
        view: null,
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

    return [];
  }

  #beginEmptyConversation(): void {
    const now = Date.now();
    this.#conversationId = randomUUID();
    this.#title = EMPTY_TITLE;
    this.#titleCustomized = false;
    this.#createdAt = now;
    this.#updatedAt = now;
    this.#status = "active";
    this.#tree = createEmptyConversationTree();
    this.#warnings.length = 0;
    this.#pendingToolBatch = null;
    this.#pending = false;
    this.#errorMessage = null;
    this.#continueAssistantId = null;
    this.#messageCounter = 0;
    this.#dirty = false;
    this.#persisted = false;
    this.#discarded = false;
  }

  #loadRecord(record: AiConversationRecord): void {
    this.#conversationId = record.id;
    this.#title = record.title;
    this.#titleCustomized = record.titleCustomized;
    this.#createdAt = record.createdAt;
    this.#updatedAt = record.updatedAt;
    this.#status = record.status;
    this.#adapterKind = toAdapterKind(record.adapterKind);
    this.#model = record.model;
    this.#selectedModelId = this.#selectedModelId || record.selectedModelId;
    this.#selectedAgentId = record.selectedAgentId;
    this.#selectedReasoningLevel = parseStoredReasoningLevel(record.selectedReasoningLevel);
    this.#pending = false;
    this.#errorMessage = record.errorMessage;
    this.#continueAssistantId = record.continueAssistantId;
    this.#dirty = false;
    this.#persisted = true;
    this.#discarded = false;

    this.#tree = parseConversationMessagesJson(
      record.messagesJson,
      record.historyJson,
      normalizeStoredMessage,
    );
    this.#messageCounter = this.#nextMessageCounterFromTree();
    this.#warnings.length = 0;
    this.#warnings.push(...this.#parseWarnings(record.warningsJson));
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

  #parseWarnings(json: string): AiChatWarning[] {
    try {
      const parsed = JSON.parse(json) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map((entry) => normalizeStoredWarning(entry));
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
  }

  #deriveTitle(): string {
    if (this.#titleCustomized) {
      return this.#title || EMPTY_TITLE;
    }
    // Prefer first user on active path; fall back to any root user.
    const path = projectActivePath(this.#tree);
    const firstUser =
      path.find((node) => node.role === "user")?.message ??
      [...this.#tree.nodes.values()].find((node) => node.role === "user")?.message;
    if (!firstUser || firstUser.role !== "user") {
      return this.#title || EMPTY_TITLE;
    }
    const text = formatUserMessageDisplay(firstUser.slash, firstUser.text)
      .trim()
      .replace(/\s+/g, " ");
    if (text === "") {
      return EMPTY_TITLE;
    }
    return text.length > TITLE_MAX_LENGTH ? `${text.slice(0, TITLE_MAX_LENGTH)}…` : text;
  }

  #nextMessageCounterFromTree(): number {
    let max = -1;
    for (const node of this.#tree.nodes.values()) {
      const match = /^ai-chat-(\d+)$/.exec(node.id);
      if (match) {
        max = Math.max(max, Number(match[1]));
      }
    }
    return max + 1;
  }

  #getMessage(id: string): AiChatMessage | null {
    return this.#tree.nodes.get(id)?.message ?? null;
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
    const node = this.#tree.nodes.get(id);
    if (!node) {
      return null;
    }

    const next = applyAiChatMessagePatch(node.message, patch);
    node.message = next;
    this.#markDirty();
    return next;
  }

  /**
   * Remove a node from the tree. If it was selected, clear parent selection.
   * Does not cascade-delete descendants (orphans remain unreachable until GC — prototype OK).
   */
  #removeMessage(id: string): boolean {
    const node = this.#tree.nodes.get(id);
    if (!node) {
      return false;
    }
    if (node.parentId === null) {
      if (this.#tree.rootSelectedId === id) {
        const roots = [...this.#tree.nodes.values()].filter(
          (candidate) => candidate.parentId === null && candidate.id !== id,
        );
        this.#tree.rootSelectedId = roots[0]?.id ?? null;
      }
    } else {
      const parent = this.#tree.nodes.get(node.parentId);
      if (parent?.selectedChildId === id) {
        parent.selectedChildId = null;
      }
    }
    this.#tree.nodes.delete(id);
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
          // Must persist UI view (e.g. subagent timeline). Deltas already carried it to the
          // renderer, but omitting it here left the authority tree + SQLite as view:null so
          // re-open / resubscribe wiped the timeline.
          view:
            patch.view !== undefined
              ? patch.view
                ? cloneAiToolView(patch.view)
                : null
              : current.view,
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
          view: fallback?.type === "tool_call" ? (fallback.view ?? null) : null,
        };
      case "opaque":
      case "server_tool_call":
      case "server_tool_result":
      case "server_tool_discovery":
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
        // Reference equality is enough: live patches replace the whole view object.
        if (current.view !== canonical.view) {
          patch.view = canonical.view;
        }
        return Object.keys(patch).length > 0 ? patch : null;
      }
    }
  }
}
