import type { RpcSubscriptionResult } from "@novelevolver/desktop-rpc/transport/stream";
import type {
  AiChatEvent,
  AiChatInteractionAnswer,
  AiChatSelectableAgent,
  AiChatSelectableModel,
  AiChatSendMessageInput,
  AiConversationDirectoryEvent,
  AiConversationSearchHit,
  AiConversationSearchOptions,
} from "@novelevolver/domain/ai/chat";
import type { AiReasoningLevel } from "@novelevolver/domain/settings/ai-settings";
import type { RpcTarget } from "capnweb";

/**
 * Active conversation turn surface (State feed).
 * Selection writes land here; model/agent catalogs live on {@link AiCatalogHandle}.
 */
export interface AiActiveChatHandle extends RpcTarget {
  subscribe(): RpcSubscriptionResult<AiChatEvent>;
  sendMessage(input: AiChatSendMessageInput): void;
  /**
   * 中断当前生成或等待用户输入。
   * - `pending`：abort 进行中的模型流 / 工具环。
   * - 存在 `openInteractions`（等待用户）：将未决交互 settle 为取消 tool_result 并落盘 history，**不**继续生成。
   * - 否则 no-op。
   */
  stopGeneration(): void;
  /**
   * 提交开放交互的回答（按 `openInteractions[].id`）。
   * 未知 id / 已 settle / kind 不匹配时幂等忽略。
   */
  submitInteraction(id: string, answer: AiChatInteractionAnswer): void;
  /**
   * 取消**单条**开放交互：工具侧以 rejected 结果 settle，工具环等齐后**继续**生成。
   * 未知 id / 已 settle 时幂等忽略。
   * 若要中断整轮输出、不再继续，请用 `stopGeneration`。
   */
  cancelInteraction(id: string): void;
  /**
   * 重新生成末条助手：在同一用户节点下新建 sibling assistant 并生成。
   * 旧版本保留，可通过 ‹n/m› 切换。requestInput 从**上一用户消息**边界重建（不复用本轮 tool 上下文）。
   * 仅当 `canRetry` 时生效，否则静默忽略。生成中 / 等待用户输入时忽略。
   */
  retryLastRequest(): void;
  /**
   * 继续被中断或失败的末条助手：在**同一 assistant 节点**上续写，不创建分叉。
   * requestInput 从 history 的 last-request 边界重建（保留已提交 tool 轮次）。
   * 仅当 `canContinue` 时生效，否则静默忽略。生成中 / 等待用户输入时忽略。
   */
  continueLastRequest(): void;
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
  setSelectedModel(modelId: string): void;
  setSelectedAgent(agentId: string): void;
  /**
   * Session reasoning effort for subsequent requests.
   * Must be a member of the current model's available levels, or `null` when unavailable.
   */
  setSelectedReasoningLevel(level: AiReasoningLevel | null): void;
}

/**
 * Project conversation directory (Directory feed, snapshot-only).
 * Search stays pull; list is replaced by {@link subscribe}.
 */
export interface AiConversationsHandle extends RpcTarget {
  /** Snapshot-only full replace; always includes active + archived summaries. */
  subscribe(): RpcSubscriptionResult<AiConversationDirectoryEvent>;
  search(query: string, options?: AiConversationSearchOptions): AiConversationSearchHit[];
  create(): void;
  switch(conversationId: string): void;
  rename(conversationId: string, title: string): void;
  archive(conversationId: string): void;
  unarchive(conversationId: string): void;
  delete(conversationId: string): void;
}

/** Selectable model / agent catalog (pull; settings-derived). */
export interface AiCatalogHandle extends RpcTarget {
  listModels(): AiChatSelectableModel[];
  listAgents(): AiChatSelectableAgent[];
}

/**
 * Project-scoped AI facade: active turn + conversation directory + catalog.
 * Mock test controls stay on {@link import("../session/project-session").ProjectSession}.
 */
export interface ProjectAi extends RpcTarget {
  readonly active: AiActiveChatHandle;
  readonly conversations: AiConversationsHandle;
  readonly catalog: AiCatalogHandle;
}
