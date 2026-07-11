import type { AiChatEvent, AiConversationSummary } from "#shared/rpc/ai/index";

import type { AiChatRepository, AiConversationRecord } from "../../db/repositories/ai-chat-repo";
import { RpcStreamPublisher } from "../../lib/stream-publisher";
import { type ResolveWorktree } from "../tools/runner";
import { AiConversationRuntime, type AiConversationRuntimeOptions } from "./conversation-runtime";
import { recordToConversationSummary } from "./conversation-state";

export type ProjectAiChatControllerOptions = {
  projectId: number;
  repository: AiChatRepository;
  resolveWorktree: ResolveWorktree;
  clientLabel?: string;
};

export class ProjectAiChatController {
  readonly #runtimeOptions: Omit<AiConversationRuntimeOptions, "record">;
  readonly #repository: AiChatRepository;
  readonly #publisher = new RpcStreamPublisher<AiChatEvent>();
  readonly #runtimes = new Map<string, AiConversationRuntime>();
  #activeConversationId = "";
  #activeRuntimeListenerCleanup: (() => void) | null = null;
  #disposed = false;

  constructor(options: ProjectAiChatControllerOptions) {
    this.#repository = options.repository;
    this.#runtimeOptions = {
      projectId: options.projectId,
      repository: options.repository,
      resolveWorktree: options.resolveWorktree,
      clientLabel: options.clientLabel,
    };

    const latest = this.#repository.getLatestByProject(options.projectId);
    const initialRuntime = latest
      ? this.#getOrCreateRuntimeFromRecord(latest)
      : this.#createRuntime();
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
    this.#setActiveRuntime(this.#createRuntime(), true);
  }

  listConversations(): AiConversationSummary[] {
    const summaries = new Map<string, AiConversationSummary>();

    for (const record of this.#repository.listByProject(this.#runtimeOptions.projectId)) {
      summaries.set(record.id, recordToConversationSummary(record));
    }

    for (const runtime of this.#runtimes.values()) {
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

  #createRuntime(record?: AiConversationRecord | null): AiConversationRuntime {
    const runtime = new AiConversationRuntime({
      ...this.#runtimeOptions,
      record,
    });
    this.#runtimes.set(runtime.conversationId, runtime);
    return runtime;
  }

  #getOrCreateRuntimeFromRecord(record: AiConversationRecord): AiConversationRuntime {
    const existing = this.#runtimes.get(record.id);
    if (existing) {
      return existing;
    }
    return this.#createRuntime(record);
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
    return this.#createRuntime(record);
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
