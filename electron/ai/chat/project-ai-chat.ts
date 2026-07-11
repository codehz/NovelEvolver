import type {
  AiChatEvent,
  AiChatSelectableModel,
  AiConversationSummary,
} from "#shared/rpc/ai/index";
import { MOCK_AI_MODEL_ID } from "#shared/rpc/ai/index";

import type { AiChatRepository, AiConversationRecord } from "../../db/repositories/ai-chat-repo";
import { RpcStreamPublisher } from "../../lib/stream-publisher";
import type { AiModelsStore } from "../../settings/ai-models-store";
import { getMockScenario } from "../mock/scenario-registry";
import type { MockScenarioPacing, MockScenarioPersistence } from "../mock/scenario-types";
import { type ResolveWorktree } from "../tools/runner";
import { AiConversationRuntime, type AiConversationRuntimeOptions } from "./conversation-runtime";
import { recordToConversationSummary } from "./conversation-state";
import {
  isSelectableModelId,
  listSelectableModels,
  resolveDefaultSelectedModelId,
} from "./selectable-models";

export type ProjectAiChatControllerOptions = {
  projectId: number;
  repository: AiChatRepository;
  resolveWorktree: ResolveWorktree;
  clientLabel?: string;
  mockAiEnabled: boolean;
  getAiModelsStore: () => AiModelsStore;
};

export class ProjectAiChatController {
  readonly #runtimeOptions: Omit<AiConversationRuntimeOptions, "record" | "selectedModelId">;
  readonly #repository: AiChatRepository;
  readonly #mockAiEnabled: boolean;
  readonly #getAiModelsStore: () => AiModelsStore;
  readonly #publisher = new RpcStreamPublisher<AiChatEvent>();
  readonly #runtimes = new Map<string, AiConversationRuntime>();
  #activeConversationId = "";
  #activeRuntimeListenerCleanup: (() => void) | null = null;
  #disposed = false;

  constructor(options: ProjectAiChatControllerOptions) {
    this.#repository = options.repository;
    this.#mockAiEnabled = options.mockAiEnabled;
    this.#getAiModelsStore = options.getAiModelsStore;
    this.#runtimeOptions = {
      projectId: options.projectId,
      repository: options.repository,
      resolveWorktree: options.resolveWorktree,
      clientLabel: options.clientLabel,
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

  createConversation(): void {
    const activeRuntime = this.#getActiveRuntime();
    if (activeRuntime.isPureDraft) {
      return;
    }

    activeRuntime.persistIfNeeded();
    this.#setActiveRuntime(
      this.#createRuntime({
        selectedModelId: this.#resolveInitialSelectedModelId(activeRuntime.selectedModelId),
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
    this.#getActiveRuntime().setSelectedModelId(normalized);
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

  listConversations(): AiConversationSummary[] {
    const summaries = new Map<string, AiConversationSummary>();

    for (const record of this.#repository.listByProject(this.#runtimeOptions.projectId)) {
      summaries.set(record.id, recordToConversationSummary(record));
    }

    for (const runtime of this.#runtimes.values()) {
      if (runtime.persistence === "ephemeral") {
        continue;
      }
      summaries.set(runtime.conversationId, runtime.getSummary());
    }

    return [...summaries.values()].sort((left, right) => {
      if (right.lastActiveAt !== left.lastActiveAt) {
        return right.lastActiveAt - left.lastActiveAt;
      }
      if (right.updatedAt !== left.updatedAt) {
        return right.updatedAt - left.updatedAt;
      }
      return right.createdAt - left.createdAt;
    });
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
  }): AiConversationRuntime {
    const record = options?.record ?? null;
    const scenario = options?.scenario;
    const selectedModelId =
      options?.selectedModelId ??
      this.#resolveInitialSelectedModelId(record?.selectedModelId ?? null);
    const runtime = new AiConversationRuntime({
      ...this.#runtimeOptions,
      record,
      scenarioId: scenario?.scenarioId,
      pacing: scenario?.pacing,
      persistence: scenario?.persistence,
      selectedModelId,
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
