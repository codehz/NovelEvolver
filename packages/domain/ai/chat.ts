import type { AiReasoningLevel } from "@novelevolver/domain/settings/ai-settings";
import type { SnapshotEvent } from "@novelevolver/domain/sync/feed";

import type { AiToolView } from "./ai-tool-view";

export type AiChatMessageUsage = {
  /**
   * Sum of input tokens across tool-loop rounds for this assistant message
   * (billing-oriented; not current prompt occupancy).
   */
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
  /** Tokens read from prompt cache (OpenAI cached_tokens, Anthropic cache_read_input_tokens). */
  cachedInputTokens?: number;
  /** Tokens written to prompt cache (Anthropic cache_creation_input_tokens). */
  cacheWriteInputTokens?: number;
  /**
   * Input tokens from the **latest** completed model request in this assistant turn.
   * Prefer this for context-window occupancy (not the summed `inputTokens`).
   */
  lastInputTokens?: number;
};

export type AiChatWarning = {
  id: string;
  /** Assistant message that triggered this provider warning. Empty when unknown. */
  messageId: string;
  message: string;
  code: string | null;
};

export type AiChatMessageStatus = "streaming" | "complete";
export type AiChatReasoningVisibility = "full" | "summary" | "redacted" | "opaque";
export type AiChatToolCallStatus = "pending" | "running" | "awaiting_user" | "complete" | "error";

export type AiChatMessagePart = {
  id: string;
  type: "message";
  text: string;
  status: AiChatMessageStatus;
};

export type AiChatReasoningPart = {
  id: string;
  type: "reasoning";
  text: string;
  visibility: AiChatReasoningVisibility;
  status: AiChatMessageStatus;
};

export type AiChatToolCall = {
  id: string;
  type: "tool_call";
  name: string;
  argumentsText: string;
  status: AiChatToolCallStatus;
  /** Model-facing result payload (JSON/text). Not the primary UI source. */
  resultText: string | null;
  errorMessage: string | null;
  /**
   * UI-only typed projection. Live updates while running; retained after complete.
   * Never forwarded to the model.
   */
  view: AiToolView | null;
};

export type AskUserChoice = {
  title: string;
  description?: string;
};

/**
 * 需要用户介入的交互会话（纯 DTO，stream 按值推送）。
 *
 * - `id` 稳定且可序列化（通常 = tool call id），供 UI 切题/草稿 key 与命令回传。
 * - **禁止**嵌入 `RpcTarget`/stub；回传走 `AiActiveChatHandle.submitInteraction` / `cancelInteraction`。
 * - 按 `kind` 扩展新交互时只加联合成员，不绑死 `ask_user`。
 */
export type AskUserOpenInteraction = {
  id: string;
  kind: "ask_user";
  toolName: "ask_user";
  /** 展示用简短提示（如问题标题）。 */
  prompt: string;
  question: string;
  context: string | null;
  placeholder: string | null;
  choices: AskUserChoice[] | null;
};

/** 当前所有可能的开放交互联合类型。 */
export type AiChatOpenInteraction = AskUserOpenInteraction;

/**
 * 交互回答 payload（按 kind 联合）。
 * 首发仅 `ask_user`；未知 id / 已 settle 时服务端幂等忽略。
 */
export type AskUserInteractionAnswer = {
  kind: "ask_user";
  text: string;
};

export type AiChatInteractionAnswer = AskUserInteractionAnswer;

export type AiChatAssistantPart = AiChatMessagePart | AiChatReasoningPart | AiChatToolCall;

export type AiChatAssistantPartPatch = {
  text?: string;
  visibility?: AiChatReasoningVisibility;
  status?: AiChatMessageStatus | AiChatToolCallStatus;
  argumentsText?: string;
  resultText?: string | null;
  errorMessage?: string | null;
  /** UI-only; omitted means leave unchanged. */
  view?: AiToolView | null;
};

/**
 * Menu-confirmed slash prompt snapshot (insert-time body).
 * Display keeps `/{slug}`; model input expands `body` on the backend.
 */
export type AiChatSlashRef = {
  promptId: string;
  slug: string;
  title: string;
  /** Prompt body snapshot at chip insert / send time. */
  body: string;
};

/**
 * Menu-confirmed project-node mention snapshot (insert-time path/label).
 * Display keeps the doc `token` (typically `@path`); model input expands to a
 * structured ref so tools can use `id` via `read_document` / `read_structure`.
 */
export type AiChatMentionRef = {
  domain: "manuscript" | "resource";
  id: string;
  kind: "folder" | "chapter" | "file";
  /** Chapter title or resource name at insert time. */
  label: string;
  /** Path snapshot at insert time (manuscript titles / resource names). */
  displayPath: string;
  /** Exact in-document token including leading `@` (stable multi-mention replace). */
  token: string;
};

/** Composer → main payload. Only a menu-confirmed chip sets `slash`. */
export type AiChatSendMessageInput = {
  /** Remainder after the leading slash chip, or the full plain draft. */
  text: string;
  /** Present only when the composer had a confirmed prompt chip. */
  slash?: AiChatSlashRef | null;
  /** Menu-confirmed `@` mentions in document order; omitted / empty when none. */
  mentions?: readonly AiChatMentionRef[] | null;
};

/** Sibling branch position on the conversation message tree (UI navigation). */
export type AiChatMessageBranch = {
  /** 0-based index among siblings (including self). */
  index: number;
  /** Sibling count under the same parent (including self). */
  count: number;
};

export type AiChatUserMessage = {
  id: string;
  role: "user";
  /**
   * Plain remainder (with slash) or full user text (without).
   * Never the expanded prompt body — that lives only in model history.
   * Mention tokens remain as stored; model history expands them separately.
   */
  text: string;
  /** Menu-confirmed slash command; `null` for plain messages / legacy rows. */
  slash: AiChatSlashRef | null;
  /** Menu-confirmed mentions; empty array for plain / legacy rows. */
  mentions: readonly AiChatMentionRef[];
  status: "complete";
  /** Present when this message has siblings on the conversation tree. */
  branch?: AiChatMessageBranch;
};

export type AiChatAssistantMessage = {
  id: string;
  role: "assistant";
  status: AiChatMessageStatus;
  /**
   * Display name of the model used for this turn (config `name`, e.g. "GPT-4o").
   * Empty for legacy rows that predate this field.
   */
  modelName: string;
  usage: AiChatMessageUsage | null;
  parts: AiChatAssistantPart[];
  /** Present when this message has siblings on the conversation tree. */
  branch?: AiChatMessageBranch;
};

export type AiChatMessage = AiChatUserMessage | AiChatAssistantMessage;

/** Sentinel id for the built-in mock provider (only listed when mock AI is enabled). */
export const MOCK_AI_MODEL_ID = "mock" as const;

export type AiChatSelectableModelKind =
  | "mock"
  | "responses"
  | "chat-completions"
  | "delta-completions"
  | "messages"
  | "ollama"
  | "gemini";

/** Model option shown in the chat composer selector. */
export type AiChatSelectableModel = {
  id: string;
  name: string;
  kind: AiChatSelectableModelKind;
  /** Provider model id / display model string. */
  model: string;
  isDefault: boolean;
  /** Configured context window; `null` when unset (hide occupancy UI). */
  contextLength: number | null;
  /**
   * Reasoning effort levels exposed for this model.
   * Empty array means hide effort UI and omit reasoningLevel on requests.
   */
  availableReasoningLevels: AiReasoningLevel[];
  /**
   * Default reasoning effort among available levels.
   * `null` when available is empty.
   */
  defaultReasoningLevel: AiReasoningLevel | null;
};

export type AiChatSelectableAgent = {
  id: string;
  name: string;
  /** Short blurb for the agent selector; empty when unset. */
  description: string;
  defaultModelId: string | null;
  toolCount: number;
  builtin: boolean;
};

export type AiChatSnapshot = {
  conversationId: string;
  adapterKind: AiChatSelectableModelKind;
  model: string;
  /** User-selected model config id (`MOCK_AI_MODEL_ID` for mock). Empty when none. */
  selectedModelId: string;
  selectedAgentId: string;
  /**
   * Session reasoning effort for the next request.
   * `null` when the current model has no available levels (omit on wire).
   */
  selectedReasoningLevel: AiReasoningLevel | null;
  scenarioId: string | null;
  warnings: AiChatWarning[];
  messages: AiChatMessage[];
  pending: boolean;
  /** 当前等待用户介入的交互会话（纯 DTO，无 stub）。 */
  openInteractions: AiChatOpenInteraction[];
  /**
   * Turn-scoped error from the last model request (shown under the last assistant turn).
   * Transport/subscription errors are client-local and not stored here.
   */
  errorMessage: string | null;
  /**
   * Whether `retryLastRequest()` can regenerate a sibling assistant from the last user message.
   * False while pending, awaiting user input, path leaf is not assistant, or history has no user boundary.
   */
  canRetry: boolean;
  /**
   * Whether `continueLastRequest()` can resume the interrupted/failed leaf assistant in-place.
   * True only when the active leaf is the marked continue assistant and last-request input rebuilds.
   */
  canContinue: boolean;
};

export type AiConversationActivity = "idle" | "streaming" | "awaiting_user";

export type AiConversationStatus = "active" | "archived";

export type AiConversationSearchOptions = {
  includeArchived?: boolean;
};

export type AiConversationSummary = {
  id: string;
  title: string;
  createdAt: number;
  /** Content/state change time; used for sidebar ordering and time groups. */
  updatedAt: number;
  activity: AiConversationActivity;
  persisted: boolean;
  scenarioId: string | null;
  status: AiConversationStatus;
};

export type AiConversationSearchHit = AiConversationSummary & {
  /** Matching fragment from title or message body; null when only title matched without body context. */
  snippet: string | null;
};

/**
 * Full conversation directory for a project.
 * Always includes active + archived (filter on the client). Sorted by recency.
 * Does **not** include activeConversationId — use active chat snapshot for that.
 */
export type AiConversationDirectorySnapshot = {
  conversations: AiConversationSummary[];
};

/** Directory feed: snapshot-only full replace. */
export type AiConversationDirectoryEvent = SnapshotEvent<AiConversationDirectorySnapshot>;

export type AiChatMessagePatch = {
  status?: AiChatMessageStatus;
  /** Refresh display model name (e.g. retry after switching model). */
  modelName?: string;
  usage?: AiChatMessageUsage | null;
};

export type AiChatStatePatch = {
  adapterKind?: AiChatSelectableModelKind;
  model?: string;
  pending?: boolean;
  openInteractions?: AiChatOpenInteraction[];
  errorMessage?: string | null;
  canRetry?: boolean;
  canContinue?: boolean;
  selectedModelId?: string;
  selectedAgentId?: string;
  selectedReasoningLevel?: AiReasoningLevel | null;
};

export type AiChatDeltaOp =
  | {
      type: "conversation.reset";
    }
  | {
      type: "warning.added";
      warning: AiChatWarning;
    }
  | {
      type: "warnings.cleared_for_message";
      messageId: string;
    }
  | {
      type: "message.added";
      message: AiChatMessage;
    }
  | {
      type: "message.updated";
      messageId: string;
      patch: AiChatMessagePatch;
    }
  | {
      type: "message.removed";
      messageId: string;
    }
  | {
      type: "assistant_parts.truncated";
      messageId: string;
      /** Keep `parts.slice(0, keepCount)`; drop the rest (uncommitted last request). */
      keepCount: number;
    }
  | {
      type: "assistant_part.added";
      messageId: string;
      part: AiChatAssistantPart;
    }
  | {
      type: "assistant_part.text.delta";
      messageId: string;
      partId: string;
      text: string;
    }
  | {
      type: "assistant_part.updated";
      messageId: string;
      partId: string;
      patch: AiChatAssistantPartPatch;
    }
  | {
      type: "state.updated";
      patch: AiChatStatePatch;
    }
  | {
      /**
       * Replace the active-path message projection after fork / branch switch / edit.
       * Does not reset conversationId or other session fields.
       */
      type: "path.replaced";
      messages: AiChatMessage[];
    };

export type AiChatSnapshotEvent = {
  kind: "snapshot";
  snapshot: AiChatSnapshot;
};

export type AiChatDeltaEvent = {
  kind: "delta";
  ops: AiChatDeltaOp[];
};

export type AiChatEvent = AiChatSnapshotEvent | AiChatDeltaEvent;

/**
 * Active conversation turn surface (State feed).
 * Selection writes land here; model/agent catalogs live on {@link AiCatalogHandle}.
 */

/**
 * Project conversation directory (Directory feed, snapshot-only).
 * Search stays pull; list is replaced by {@link subscribe}.
 */

/** Selectable model / agent catalog (pull; settings-derived). */

/**
 * Project-scoped AI facade: active turn + conversation directory + catalog.
 * Mock test controls stay on {@link import("../session/project-session-rpc").ProjectSession}.
 */
