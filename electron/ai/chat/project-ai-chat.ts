import type {
  AiChatEvent,
  AiChatInteractionAnswer,
  AiChatSelectableAgent,
  AiChatSelectableModel,
  AiChatSendMessageInput,
  AiConversationDirectoryEvent,
  AiConversationSearchHit,
  AiConversationSearchOptions,
  AiConversationStatus,
  AiConversationSummary,
} from "#shared/rpc/ai/index";
import { MOCK_AI_MODEL_ID } from "#shared/rpc/ai/index";
import { BUILTIN_AI_AGENT_ID, type AiReasoningLevel } from "#shared/rpc/services/index";

import type { AiChatRepository, AiConversationRecord } from "../../db/repositories/ai-chat-repo";
import { RpcStreamPublisher } from "../../lib/stream-publisher";
import type { AiAgentsStore } from "../../settings/ai-agents-store";
import type { AiModelsStore } from "../../settings/ai-models-store";
import type { AiRuntimePolicyStore } from "../../settings/ai-runtime-policy-store";
import { getMockScenario } from "../mock/scenario-registry";
import type { MockScenarioPacing, MockScenarioPersistence } from "../mock/scenario-types";
import { type ResolveWorktree } from "../tools";
import { AiConversationRuntime, type AiConversationRuntimeOptions } from "./conversation-runtime";
import { recordToConversationSummary } from "./conversation-state";
import {
  isSelectableModelId,
  listSelectableModels,
  resolveDefaultSelectedModelId,
  resolveReasoningLevelForModel,
} from "./selectable-models";
import { formatUserMessageDisplay } from "./slash-expand";

const SEARCH_SNIPPET_RADIUS = 36;
const SEARCH_SNIPPET_MAX = 96;

function compareConversationRecency(
  left: Pick<AiConversationSummary, "updatedAt" | "id">,
  right: Pick<AiConversationSummary, "updatedAt" | "id">,
): number {
  if (right.updatedAt !== left.updatedAt) {
    return right.updatedAt - left.updatedAt;
  }
  return right.id.localeCompare(left.id);
}

function extractSearchSnippet(text: string, query: string): string | null {
  const haystack = text.replace(/\s+/g, " ").trim();
  if (haystack === "") {
    return null;
  }
  const lowerHaystack = haystack.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerHaystack.indexOf(lowerQuery);
  if (index < 0) {
    return null;
  }
  const start = Math.max(0, index - SEARCH_SNIPPET_RADIUS);
  const end = Math.min(haystack.length, index + lowerQuery.length + SEARCH_SNIPPET_RADIUS);
  let snippet = haystack.slice(start, end).trim();
  if (start > 0) {
    snippet = `…${snippet}`;
  }
  if (end < haystack.length) {
    snippet = `${snippet}…`;
  }
  if (snippet.length > SEARCH_SNIPPET_MAX) {
    snippet = `${snippet.slice(0, SEARCH_SNIPPET_MAX - 1)}…`;
  }
  return snippet;
}

function extractSnippetFromMessagesJson(messagesJson: string, query: string): string | null {
  try {
    const parsed = JSON.parse(messagesJson) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const message = entry as Record<string, unknown>;
      if (message.role === "user" && typeof message.text === "string") {
        const slash =
          message.slash && typeof message.slash === "object"
            ? (message.slash as { slug?: unknown })
            : null;
        const display =
          slash && typeof slash.slug === "string"
            ? formatUserMessageDisplay(
                {
                  promptId: "",
                  slug: slash.slug,
                  title: "",
                  body: "",
                },
                message.text,
              )
            : message.text;
        const snippet = extractSearchSnippet(display, query);
        if (snippet) {
          return snippet;
        }
      }
      if (message.role === "assistant" && Array.isArray(message.parts)) {
        for (const part of message.parts) {
          if (!part || typeof part !== "object") {
            continue;
          }
          const typed = part as Record<string, unknown>;
          if (
            (typed.type === "message" || typed.type === "reasoning") &&
            typeof typed.text === "string"
          ) {
            const snippet = extractSearchSnippet(typed.text, query);
            if (snippet) {
              return snippet;
            }
          }
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

export type ProjectAiChatControllerOptions = {
  projectId: number;
  repository: AiChatRepository;
  resolveWorktree: ResolveWorktree;
  clientLabel?: string;
  mockAiEnabled: boolean;
  getAiModelsStore: () => AiModelsStore;
  getAiAgentsStore: () => AiAgentsStore;
  getAiRuntimePolicyStore: () => AiRuntimePolicyStore;
};

export class ProjectAiChatController {
  readonly #runtimeOptions: Omit<
    AiConversationRuntimeOptions,
    "record" | "selectedModelId" | "selectedAgentId" | "initialAdapterKind" | "initialModel"
  >;
  readonly #repository: AiChatRepository;
  readonly #mockAiEnabled: boolean;
  readonly #getAiModelsStore: () => AiModelsStore;
  readonly #getAiAgentsStore: () => AiAgentsStore;
  readonly #getAiRuntimePolicyStore: () => AiRuntimePolicyStore;
  readonly #publisher = new RpcStreamPublisher<AiChatEvent>();
  readonly #directoryPublisher = new RpcStreamPublisher<AiConversationDirectoryEvent>();
  readonly #runtimes = new Map<string, AiConversationRuntime>();
  #activeConversationId = "";
  #activeRuntimeListenerCleanup: (() => void) | null = null;
  #disposed = false;

  constructor(options: ProjectAiChatControllerOptions) {
    this.#repository = options.repository;
    this.#mockAiEnabled = options.mockAiEnabled;
    this.#getAiModelsStore = options.getAiModelsStore;
    this.#getAiAgentsStore = options.getAiAgentsStore;
    this.#getAiRuntimePolicyStore = options.getAiRuntimePolicyStore;
    this.#runtimeOptions = {
      projectId: options.projectId,
      repository: options.repository,
      resolveWorktree: options.resolveWorktree,
      clientLabel: options.clientLabel,
      resolveModelConfig: (modelId) => this.#getAiModelsStore().getRuntimeConfig(modelId),
      resolveAgentConfig: (agentId) => this.#getAiAgentsStore().getRuntimeConfig(agentId),
      listAgentConfigs: () => this.#getAiAgentsStore().getSnapshot().agents,
      getRuntimePolicy: () => this.#getAiRuntimePolicyStore().getSnapshot(),
    };

    const latest = this.#repository.getLatestByProject(options.projectId);
    const initialRuntime = latest
      ? this.#getOrCreateRuntimeFromRecord(latest)
      : this.#createRuntime({
          selectedModelId: this.#resolveInitialSelectedModelId(null),
        });
    this.#setActiveRuntime(initialRuntime, false);
  }

  subscribe(): ReadableStream<AiChatEvent> {
    return this.#publisher.subscribe({
      getInitialValue: () => ({
        kind: "snapshot",
        snapshot: this.#getActiveRuntime().getSnapshot(),
      }),
    });
  }

  /** Directory feed: always active + archived, snapshot-only full replace. */
  subscribeDirectory(): ReadableStream<AiConversationDirectoryEvent> {
    return this.#directoryPublisher.subscribe({
      getInitialValue: () => this.#currentDirectoryEvent(),
    });
  }

  sendMessage(input: AiChatSendMessageInput): void {
    this.#getActiveRuntime().sendMessage(input);
  }

  stopGeneration(): void {
    this.#getActiveRuntime().stopGeneration();
  }

  submitInteraction(id: string, answer: AiChatInteractionAnswer): void {
    this.#getActiveRuntime().submitInteraction(id, answer);
  }

  cancelInteraction(id: string): void {
    this.#getActiveRuntime().cancelInteraction(id);
  }

  retryLastRequest(): void {
    this.#getActiveRuntime().retryLastRequest();
  }

  selectMessageBranch(messageId: string, index: number): void {
    this.#getActiveRuntime().selectMessageBranch(messageId, index);
  }

  editUserMessage(messageId: string, input: AiChatSendMessageInput): void {
    this.#getActiveRuntime().editUserMessage(messageId, input);
  }

  createConversation(): void {
    const activeRuntime = this.#getActiveRuntime();
    if (activeRuntime.isPureDraft) {
      return;
    }

    activeRuntime.persistIfNeeded();
    this.#setActiveRuntime(
      this.#createRuntime({
        selectedModelId: this.#resolveInitialSelectedModelId(activeRuntime.selectedModelId),
        selectedAgentId: activeRuntime.selectedAgentId,
      }),
      true,
    );
    this.#emitDirectory();
  }

  listSelectableModels(): AiChatSelectableModel[] {
    return listSelectableModels({
      mockAiEnabled: this.#mockAiEnabled,
      models: this.#getAiModelsStore().getSnapshot(),
    });
  }

  setSelectedModel(modelId: string): void {
    const normalized = modelId.trim();
    if (normalized === "") {
      throw new Error("模型 id 不能为空。");
    }
    if (
      !isSelectableModelId(normalized, {
        mockAiEnabled: this.#mockAiEnabled,
        models: this.#getAiModelsStore().getSnapshot(),
      })
    ) {
      throw new Error("所选模型不可用。");
    }
    const model = this.listSelectableModels().find((entry) => entry.id === normalized);
    if (!model) {
      throw new Error("所选模型不可用。");
    }
    this.#getActiveRuntime().setSelectedModel(normalized, model.kind, model.model);
  }

  listSelectableAgents(): AiChatSelectableAgent[] {
    return this.#getAiAgentsStore()
      .getSnapshot()
      .agents.filter((agent) => agent.userSelectable)
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
        defaultModelId: agent.defaultModelId,
        toolCount: agent.availableToolNames.length,
        builtin: agent.builtin,
      }));
  }

  setSelectedAgent(agentId: string): void {
    const normalized = agentId.trim();
    if (normalized === "") {
      throw new Error("Agent id 不能为空。");
    }

    const agent = this.#getAiAgentsStore().findRuntimeConfig(normalized);
    if (!agent) {
      throw new Error(`Agent「${normalized}」不存在。`);
    }
    if (!agent.userSelectable) {
      throw new Error(`Agent「${agent.name}」未开放给用户选择。`);
    }

    const modelsSnapshot = this.#getAiModelsStore().getSnapshot();
    const targetModelId =
      agent.defaultModelId &&
      isSelectableModelId(agent.defaultModelId, {
        mockAiEnabled: this.#mockAiEnabled,
        models: modelsSnapshot,
      })
        ? agent.defaultModelId
        : resolveDefaultSelectedModelId({
            mockAiEnabled: this.#mockAiEnabled,
            models: modelsSnapshot,
            preferredId: null,
          });

    const modelEntry = this.listSelectableModels().find((m) => m.id === targetModelId);
    this.#getActiveRuntime().setSelectedAgent(
      agent.id,
      modelEntry?.id ?? "",
      modelEntry?.kind ?? "mock",
      modelEntry?.model ?? "",
    );
  }

  setSelectedReasoningLevel(level: AiReasoningLevel | null): void {
    this.#getActiveRuntime().setSelectedReasoningLevel(level);
  }

  runScenario(options: {
    scenarioId: string;
    pacing: MockScenarioPacing;
    persistence: MockScenarioPersistence;
  }): void {
    if (!this.#mockAiEnabled) {
      throw new Error("当前未启用 mock AI 测试模式。");
    }
    const scenario = getMockScenario(options.scenarioId);
    this.#getActiveRuntime().persistIfNeeded();
    const runtime = this.#createRuntime({
      scenario: options,
      selectedModelId: MOCK_AI_MODEL_ID,
    });
    this.#setActiveRuntime(runtime, true);
    runtime.sendMessage({ text: scenario.initialPrompt, slash: null });
  }

  rerunActiveScenario(): void {
    const snapshot = this.#getActiveRuntime().getSnapshot();
    if (!snapshot.scenarioId) {
      throw new Error("当前会话不是 mock AI 测试场景。");
    }
    this.runScenario({
      scenarioId: snapshot.scenarioId,
      pacing: "preview",
      persistence: this.#getActiveRuntime().persistence,
    });
  }

  /**
   * In-memory + repo merge for conversation directory.
   * When `includeArchived` is true, returns active + archived (directory feed).
   * Ephemeral mock runtimes are always excluded.
   */
  listConversations(options?: { includeArchived?: boolean }): AiConversationSummary[] {
    const includeArchived = options?.includeArchived === true;
    const summaries = new Map<string, AiConversationSummary>();

    for (const record of this.#repository.listSummariesByProject(this.#runtimeOptions.projectId, {
      status: includeArchived ? "all" : "active",
    })) {
      summaries.set(record.id, recordToConversationSummary(record));
    }

    for (const runtime of this.#runtimes.values()) {
      if (runtime.persistence === "ephemeral") {
        continue;
      }
      const summary = runtime.getSummary();
      if (!includeArchived && summary.status === "archived") {
        continue;
      }
      summaries.set(runtime.conversationId, summary);
    }

    return [...summaries.values()].sort(compareConversationRecency);
  }

  searchConversations(
    query: string,
    options?: AiConversationSearchOptions,
  ): AiConversationSearchHit[] {
    const normalized = query.trim();
    if (normalized === "") {
      return [];
    }

    const includeArchived = options?.includeArchived === true;
    const hits = new Map<string, AiConversationSearchHit>();
    const lowerQuery = normalized.toLowerCase();

    for (const record of this.#repository.searchByProject(
      this.#runtimeOptions.projectId,
      normalized,
      { includeArchived },
    )) {
      const summary = recordToConversationSummary(record);
      const titleMatch = summary.title.toLowerCase().includes(lowerQuery);
      const snippet =
        extractSnippetFromMessagesJson(record.messagesJson, normalized) ??
        (titleMatch ? null : null);
      hits.set(summary.id, { ...summary, snippet });
    }

    for (const runtime of this.#runtimes.values()) {
      if (runtime.persistence === "ephemeral") {
        continue;
      }
      const summary = runtime.getSummary();
      if (!includeArchived && summary.status === "archived") {
        continue;
      }

      const titleMatch = summary.title.toLowerCase().includes(lowerQuery);
      let snippet: string | null = null;
      if (!titleMatch || !hits.has(summary.id)) {
        for (const text of runtime.collectSearchableTexts()) {
          snippet = extractSearchSnippet(text, normalized);
          if (snippet) {
            break;
          }
        }
      }
      if (!titleMatch && snippet == null) {
        continue;
      }
      hits.set(summary.id, {
        ...summary,
        snippet: snippet ?? hits.get(summary.id)?.snippet ?? null,
      });
    }

    return [...hits.values()].sort(compareConversationRecency);
  }

  switchConversation(conversationId: string): void {
    const normalized = conversationId.trim();
    if (normalized === "") {
      throw new Error("会话 id 不能为空。");
    }
    if (normalized === this.#activeConversationId) {
      return;
    }

    this.#getActiveRuntime().persistIfNeeded();
    const runtime = this.#getOrLoadRuntime(normalized);
    this.#setActiveRuntime(runtime, true);
  }

  renameConversation(conversationId: string, title: string): void {
    const normalized = conversationId.trim();
    if (normalized === "") {
      throw new Error("会话 id 不能为空。");
    }
    const runtime = this.#getOrLoadRuntime(normalized);
    runtime.rename(title);
    this.#emitDirectory();
  }

  archiveConversation(conversationId: string): void {
    this.#setConversationStatus(conversationId, "archived");
  }

  unarchiveConversation(conversationId: string): void {
    this.#setConversationStatus(conversationId, "active");
  }

  deleteConversation(conversationId: string): void {
    const normalized = conversationId.trim();
    if (normalized === "") {
      throw new Error("会话 id 不能为空。");
    }

    const wasActive = normalized === this.#activeConversationId;
    this.#disposeRuntime(normalized, { persist: false });
    this.#repository.deleteById(this.#runtimeOptions.projectId, normalized);

    if (wasActive) {
      this.#activateNextOrCreate(normalized);
    }
    this.#emitDirectory();
  }

  [Symbol.dispose](): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.#activeRuntimeListenerCleanup?.();
    this.#activeRuntimeListenerCleanup = null;

    try {
      for (const runtime of this.#runtimes.values()) {
        runtime[Symbol.dispose]();
      }
    } finally {
      this.#runtimes.clear();
      this.#publisher[Symbol.dispose]();
      this.#directoryPublisher[Symbol.dispose]();
    }
  }

  #createRuntime(options?: {
    record?: AiConversationRecord | null;
    scenario?: {
      scenarioId: string;
      pacing: MockScenarioPacing;
      persistence: MockScenarioPersistence;
    };
    selectedModelId?: string;
    selectedAgentId?: string;
  }): AiConversationRuntime {
    const record = options?.record ?? null;
    const scenario = options?.scenario;
    const selectedModelId =
      options?.selectedModelId ??
      this.#resolveInitialSelectedModelId(record?.selectedModelId ?? null);
    const selectedModel = this.listSelectableModels().find((model) => model.id === selectedModelId);
    // New conversations (no record): use model default. Loaded records: let runtime validate stored value.
    const selectedReasoningLevel = record
      ? undefined
      : resolveReasoningLevelForModel(selectedModel, null);
    const runtime = new AiConversationRuntime({
      ...this.#runtimeOptions,
      record,
      scenarioId: scenario?.scenarioId,
      pacing: scenario?.pacing,
      persistence: scenario?.persistence,
      selectedModelId,
      selectedAgentId: options?.selectedAgentId ?? record?.selectedAgentId ?? BUILTIN_AI_AGENT_ID,
      selectedReasoningLevel,
      initialAdapterKind: selectedModel?.kind ?? "mock",
      initialModel: selectedModel?.model ?? "",
    });
    this.#runtimes.set(runtime.conversationId, runtime);
    return runtime;
  }

  #resolveInitialSelectedModelId(preferredId: string | null): string {
    return resolveDefaultSelectedModelId({
      mockAiEnabled: this.#mockAiEnabled,
      models: this.#getAiModelsStore().getSnapshot(),
      preferredId,
    });
  }

  #getOrCreateRuntimeFromRecord(record: AiConversationRecord): AiConversationRuntime {
    const existing = this.#runtimes.get(record.id);
    if (existing) {
      return existing;
    }
    return this.#createRuntime({ record });
  }

  #getOrLoadRuntime(conversationId: string): AiConversationRuntime {
    const existing = this.#runtimes.get(conversationId);
    if (existing) {
      return existing;
    }

    const record = this.#repository.getById(this.#runtimeOptions.projectId, conversationId);
    if (!record) {
      throw new Error("找不到指定的 AI 会话。");
    }
    return this.#createRuntime({ record });
  }

  #getActiveRuntime(): AiConversationRuntime {
    const runtime = this.#runtimes.get(this.#activeConversationId);
    if (!runtime) {
      throw new Error("当前没有激活的 AI 会话。");
    }
    return runtime;
  }

  #setConversationStatus(conversationId: string, status: AiConversationStatus): void {
    const normalized = conversationId.trim();
    if (normalized === "") {
      throw new Error("会话 id 不能为空。");
    }

    const wasActive = normalized === this.#activeConversationId;
    const runtime = this.#runtimes.get(normalized);
    if (runtime) {
      runtime.stopGeneration();
      runtime.setStatus(status);
    } else {
      const updated = this.#repository.setStatus(
        this.#runtimeOptions.projectId,
        normalized,
        status,
      );
      if (!updated) {
        throw new Error("找不到指定的 AI 会话。");
      }
    }

    if (wasActive && status === "archived") {
      this.#activateNextOrCreate(normalized);
    }
    this.#emitDirectory();
  }

  #disposeRuntime(conversationId: string, options: { persist: boolean }): void {
    const runtime = this.#runtimes.get(conversationId);
    if (!runtime) {
      return;
    }

    if (conversationId === this.#activeConversationId) {
      this.#activeRuntimeListenerCleanup?.();
      this.#activeRuntimeListenerCleanup = null;
    }

    runtime.stopGeneration();
    if (!options.persist) {
      runtime.discard();
    }
    this.#runtimes.delete(conversationId);
    runtime[Symbol.dispose]();
  }

  #activateNextOrCreate(excludeId: string): void {
    const next = this.listConversations({ includeArchived: false }).find(
      (conversation) => conversation.id !== excludeId,
    );
    if (next) {
      const runtime = this.#getOrLoadRuntime(next.id);
      this.#setActiveRuntime(runtime, true);
      return;
    }

    const runtime = this.#createRuntime({
      selectedModelId: this.#resolveInitialSelectedModelId(null),
    });
    this.#setActiveRuntime(runtime, true);
  }

  #setActiveRuntime(runtime: AiConversationRuntime, emitSnapshot: boolean): void {
    this.#activeRuntimeListenerCleanup?.();
    this.#activeConversationId = runtime.conversationId;
    this.#activeRuntimeListenerCleanup = runtime.addEventListener((event) => {
      if (runtime.conversationId !== this.#activeConversationId) {
        return;
      }
      this.#publisher.emit(event);
      if (directoryRelevantActiveEvent(event)) {
        this.#emitDirectory();
      }
    });

    if (emitSnapshot) {
      this.#publisher.emit({
        kind: "snapshot",
        snapshot: runtime.getSnapshot(),
      });
    }
  }

  #currentDirectoryEvent(): AiConversationDirectoryEvent {
    return {
      kind: "snapshot",
      snapshot: {
        conversations: this.listConversations({ includeArchived: true }),
      },
    };
  }

  #emitDirectory(): void {
    this.#directoryPublisher.emit(this.#currentDirectoryEvent());
  }
}

/** Skip high-frequency text deltas; refresh directory on activity / title / structure signals. */
function directoryRelevantActiveEvent(event: AiChatEvent): boolean {
  if (event.kind === "snapshot") {
    return true;
  }
  return event.ops.some(
    (op) =>
      op.type === "state.updated" ||
      op.type === "message.added" ||
      op.type === "message.removed" ||
      op.type === "message.updated" ||
      op.type === "path.replaced" ||
      op.type === "conversation.reset",
  );
}
