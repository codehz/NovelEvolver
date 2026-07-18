import type { RpcTarget } from "capnweb";

import type { AiReasoningLevel } from "../services/settings-rpc";
import type { RpcSubscriptionResult } from "../transport/stream";

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
  resultText: string | null;
  errorMessage: string | null;
  /**
   * UI-only live progress payload (JSON string). Not forwarded to the model.
   * Cleared when the tool call reaches a terminal status.
   */
  progressText: string | null;
};

export type AskUserChoice = {
  title: string;
  description?: string;
};

/**
 * 用户输入请求 handle：仅暴露回传方法。
 *
 * Cap'n Web 的 `RpcTarget` 按引用传递，客户端拿到的是 stub；属性读取是异步
 * `RpcPromise`，不能当作同步字段做 UI 分派。展示数据放在旁路纯 DTO
 *（`AiChatPendingUserInput`）里随 snapshot/delta 按值推送。
 */
export interface UserInputRequestHandle extends RpcTarget {
  /** 提交回答；幂等：重复调用会被忽略。 */
  submitAnswer(text: string): void;
  /** 取消回答，工具将以 rejected 结果返回给 AI。 */
  cancel(): void;
}

/**
 * `ask_user` 工具的 typed handle：期望一段文本回答。
 */
export interface AskUserRequestHandle extends UserInputRequestHandle {}

/**
 * 需要用户回答的请求视图（按值）+ 提交 handle（按引用）。
 * 客户端按 `kind` 分派 UI，只读 DTO 字段；回传调用 `handle` 方法。
 */
export type AskUserPendingInput = {
  kind: "ask_user";
  toolName: "ask_user";
  /** 展示用简短提示（如问题标题）。 */
  prompt: string;
  question: string;
  context: string | null;
  placeholder: string | null;
  choices: AskUserChoice[] | null;
  handle: AskUserRequestHandle;
};

/** 当前所有可能的用户输入请求联合类型。 */
export type AiChatPendingUserInput = AskUserPendingInput;

export type AiChatAssistantPart = AiChatMessagePart | AiChatReasoningPart | AiChatToolCall;

export type AiChatAssistantPartPatch = {
  text?: string;
  visibility?: AiChatReasoningVisibility;
  status?: AiChatMessageStatus | AiChatToolCallStatus;
  argumentsText?: string;
  resultText?: string | null;
  errorMessage?: string | null;
  /** UI-only; omitted means leave unchanged. */
  progressText?: string | null;
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
  | "messages"
  | "ollama";

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
  pendingUserInputs: AiChatPendingUserInput[];
  /**
   * Turn-scoped error from the last model request (shown under the last assistant turn).
   * Transport/subscription errors are client-local and not stored here.
   */
  errorMessage: string | null;
  /**
   * Whether `retryLastRequest()` can re-issue the last model request from history.
   * False while pending, awaiting user input, or when history cannot rebuild a request.
   */
  canRetry: boolean;
};

export type AiConversationActivity = "idle" | "streaming" | "awaiting_user";

export type AiConversationStatus = "active" | "archived";

export type AiConversationListOptions = {
  includeArchived?: boolean;
};

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
  pendingUserInputs?: AiChatPendingUserInput[];
  errorMessage?: string | null;
  canRetry?: boolean;
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

export interface AiChatHandle extends RpcTarget {
  subscribeChat(): RpcSubscriptionResult<AiChatEvent>;
  sendMessage(input: AiChatSendMessageInput): void;
  /** Abort the in-flight model stream / tool loop when `pending`. No-op otherwise. */
  stopGeneration(): void;
  /**
   * 从上一次 model request 边界重试（非整 turn）。
   * 从 history 剥掉末尾模型输出后重发；成功 / 失败 / stop / 历史会话均可，
   * 仅当 `canRetry` 时生效，否则静默忽略。不重放已完成工具。
   */
  retryLastRequest(): void;
  /**
   * 将会话活跃路径截到指定消息（仅允许当前活跃路径上的节点）。
   * 不删除子树；后续发送将从该点长出新支路。生成中 / 等待用户输入时忽略。
   */
  forkFromMessage(messageId: string): void;
  /**
   * 在指定消息的兄弟分支中切换到 `index`（0-based）。
   * 生成中 / 等待用户输入时忽略。
   */
  selectMessageBranch(messageId: string, index: number): void;
  /**
   * 编辑历史用户消息：创建兄弟 user 节点并立即发起新生成；原支路保留。
   * 生成中 / 等待用户输入时忽略。
   */
  editUserMessage(messageId: string, input: AiChatSendMessageInput): void;
  createConversation(): void;
  listConversations(options?: AiConversationListOptions): AiConversationSummary[];
  searchConversations(
    query: string,
    options?: AiConversationSearchOptions,
  ): AiConversationSearchHit[];
  switchConversation(conversationId: string): void;
  renameConversation(conversationId: string, title: string): void;
  archiveConversation(conversationId: string): void;
  unarchiveConversation(conversationId: string): void;
  deleteConversation(conversationId: string): void;
  listSelectableModels(): AiChatSelectableModel[];
  setSelectedModel(modelId: string): void;
  listSelectableAgents(): AiChatSelectableAgent[];
  setSelectedAgent(agentId: string): void;
  /**
   * Session reasoning effort for subsequent requests.
   * Must be a member of the current model's available levels, or `null` when unavailable.
   */
  setSelectedReasoningLevel(level: AiReasoningLevel | null): void;
}
