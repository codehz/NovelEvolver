import type {
  AiChatEvent,
  AiChatSelectableAgent,
  AiChatSelectableModel,
  AiConversationListOptions,
  AiConversationSearchHit,
  AiConversationSearchOptions,
  AiConversationStatus,
  AiConversationSummary,
} from "#shared/rpc/ai/index";
import { MOCK_AI_MODEL_ID } from "#shared/rpc/ai/index";
import { BUILTIN_AI_AGENT_ID } from "#shared/rpc/services/index";

import type { AiChatRepository, AiConversationRecord } from "../../db/repositories/ai-chat-repo";
import { RpcStreamPublisher } from "../../lib/stream-publisher";
import type { AiAgentsStore } from "../../settings/ai-agents-store";
import type { AiModelsStore } from "../../settings/ai-models-store";
import { getMockScenario } from "../mock/scenario-registry";
import type { MockScenarioPacing, MockScenarioPersistence } from "../mock/scenario-types";
import { type ResolveWorktree } from "../tools";
import { AiConversationRuntime, type AiConversationRuntimeOptions } from "./conversation-runtime";
import { recordToConversationSummary } from "./conversation-state";
import {
  isSelectableModelId,
  listSelectableModels,
  resolveDefaultSelectedModelId,
} from "./selectable-models";

const SEARCH_SNIPPET_RADIUS = 36;
const SEARCH_SNIPPET_MAX = 96;

function compareConversationRecency(
  left: Pick<AiConversationSummary, "lastActiveAt" | "id">,
  right: Pick<AiConversationSummary, "lastActiveAt" | "id">,
): number {
  if (right.lastActiveAt !== left.lastActiveAt) {
    return right.lastActiveAt - left.lastActiveAt;
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
        const snippet = extractSearchSnippet(message.text, query);
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
  readonly #publisher = new RpcStreamPublisher<AiChatEvent>();
  readonly #runtimes = new Map<string, AiConversationRuntime>();
  #activeConversationId = "";
  #activeRuntimeListenerCleanup: (() => void) | null = null;
  #disposed = false;

  constructor(options: ProjectAiChatControllerOptions) {
    this.#repository = options.repository;
    this.#mockAiEnabled = options.mockAiEnabled;
    this.#getAiModelsStore = options.getAiModelsStore;
    this.#getAiAgentsStore = options.getAiAgentsStore;
    this.#runtimeOptions = {
      projectId: options.projectId,
      repository: options.repository,
      resolveWorktree: options.resolveWorktree,
      clientLabel: options.clientLabel,
      resolveModelConfig: (modelId) => this.#getAiModelsStore().getRuntimeConfig(modelId),
      resolveAgentConfig: (agentId) => this.#getAiAgentsStore().getRuntimeConfig(agentId),
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

  sendMessage(text: string): void {
    this.#getActiveRuntime().sendMessage(text);
  }

  stopGeneration(): void {
    this.#getActiveRuntime().stopGeneration();
  }

  retryLastRequest(): void {
    this.#getActiveRuntime().retryLastRequest();
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
      .agents.map((agent) => ({
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

    const agent = this.#getAiAgentsStore().getRuntimeConfig(normalized);

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
    runtime.sendMessage(scenario.initialPrompt);
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

  listConversations(options?: AiConversationListOptions): AiConversationSummary[] {
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
    runtime.touchLastActive();
    runtime.persistIfNeeded();
    this.#setActiveRuntime(runtime, true);
  }

  renameConversation(conversationId: string, title: string): void {
    const normalized = conversationId.trim();
    if (normalized === "") {
      throw new Error("会话 id 不能为空。");
    }
    const runtime = this.#getOrLoadRuntime(normalized);
    runtime.rename(title);
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
    const runtime = new AiConversationRuntime({
      ...this.#runtimeOptions,
      record,
      scenarioId: scenario?.scenarioId,
      pacing: scenario?.pacing,
      persistence: scenario?.persistence,
      selectedModelId,
      selectedAgentId: options?.selectedAgentId ?? record?.selectedAgentId ?? BUILTIN_AI_AGENT_ID,
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
      runtime.touchLastActive();
      runtime.persistIfNeeded();
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
    });

    if (emitSnapshot) {
      this.#publisher.emit({
        kind: "snapshot",
        snapshot: runtime.getSnapshot(),
      });
    }
  }
}
