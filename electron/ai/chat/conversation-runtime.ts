import type {
  AIResponse,
  AIStreamEvent,
  InputItem,
  ToolCallItem,
  ToolResultItem,
} from "@codehz/ai";
import { aggregateEvents } from "@codehz/ai";

import { cloneAiChatMessage } from "#shared/rpc/ai/index";
import type {
  AiChatMessageUsage,
  AiChatSelectableModelKind,
  AiChatDeltaOp,
  AiChatEvent,
  AiChatSnapshot,
  AiConversationSummary,
} from "#shared/rpc/ai/index";

import type { AiChatRepository, AiConversationRecord } from "../../db/repositories/ai-chat-repo";
import { RpcStreamPublisher } from "../../lib/stream-publisher";
import type { AiAgentRuntimeConfig } from "../../settings/ai-agents-store";
import type { AiModelRuntimeConfig } from "../../settings/ai-models-store";
import { addMessageUsage, joinContentBlocksText, toErrorMessage } from "../ai-utils";
import type { AiBackendSession } from "../backend/ai-backend-session";
import { createAiBackendSession } from "../backend/create-ai-backend";
import { toInputItem } from "../mock-adapter";
import { getMockScenario } from "../mock/scenario-registry";
import { createScenarioToolRunner } from "../mock/scenario-tool-runner";
import type { MockScenarioPacing, MockScenarioPersistence } from "../mock/scenario-types";
import {
  AI_TOOLS,
  AI_TOOLS_MAP,
  createToolRunner,
  type ResolveWorktree,
  type ToolRunner,
} from "../tools";
import { AiConversationState } from "./conversation-state";
import { createPendingUserInputFromRequest, type PendingToolBatch } from "./pending-tool-batch";

type RuntimeEventListener = (event: AiChatEvent) => void;

export type AiConversationRuntimeOptions = {
  projectId: number;
  repository: AiChatRepository;
  resolveWorktree: ResolveWorktree;
  clientLabel?: string;
  record?: AiConversationRecord | null;
  scenarioId?: string | null;
  pacing?: MockScenarioPacing;
  persistence?: MockScenarioPersistence;
  /** Initial selected model id for new conversations (ignored when loading a record with a stored id). */
  selectedModelId?: string;
  /** Initial selected agent id for new conversations. */
  selectedAgentId?: string;
  initialAdapterKind: AiChatSelectableModelKind;
  initialModel: string;
  resolveModelConfig: (modelId: string) => AiModelRuntimeConfig | null;
  resolveAgentConfig: (agentId: string) => AiAgentRuntimeConfig;
};

const MAX_TOOL_ROUNDS = 16;

export function shouldProcessToolCalls(response: Pick<AIResponse, "toolCalls">): boolean {
  return response.toolCalls.length > 0;
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Build history items only from still-streaming assistant parts.
 * Completed rounds are already in `transcript` via provider replay; do not re-add them.
 */
function incompleteAssistantPartsToHistoryItems(
  state: AiConversationState,
  assistantMessageId: string,
): InputItem[] {
  const message = state
    .getSnapshot()
    .messages.find((entry) => entry.id === assistantMessageId && entry.role === "assistant");
  if (!message || message.role !== "assistant") {
    return [];
  }

  const items: InputItem[] = [];
  for (const part of message.parts) {
    if (part.type === "message" && part.status === "streaming" && part.text.trim() !== "") {
      items.push({
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: part.text }],
      });
      continue;
    }
    if (part.type === "reasoning" && part.status === "streaming" && part.text.trim() !== "") {
      items.push({
        type: "reasoning",
        visibility: part.visibility,
        content: [{ type: "text", text: part.text }],
      });
    }
  }
  return items;
}

export class AiConversationRuntime {
  readonly #toolRunner: ToolRunner;
  readonly #publisher = new RpcStreamPublisher<AiChatEvent>();
  readonly #eventListeners = new Set<RuntimeEventListener>();
  readonly #state: AiConversationState;
  readonly #clientLabel: string;
  readonly #resolveModelConfig: AiConversationRuntimeOptions["resolveModelConfig"];
  readonly #resolveAgentConfig: AiConversationRuntimeOptions["resolveAgentConfig"];
  readonly #scenarioBackend: AiBackendSession | null;
  #activeBackend: AiBackendSession | null = null;
  #generationAbort: AbortController | null = null;
  #disposed = false;

  constructor(options: AiConversationRuntimeOptions) {
    const scenarioId = options.record?.scenarioId ?? options.scenarioId ?? null;
    this.#clientLabel = options.clientLabel ?? `project-${options.projectId}`;
    this.#resolveModelConfig = options.resolveModelConfig;
    this.#resolveAgentConfig = options.resolveAgentConfig;
    this.#scenarioBackend = scenarioId
      ? createAiBackendSession({
          clientLabel: this.#clientLabel,
          scenarioId,
          pacing: options.pacing,
        })
      : null;
    const realToolRunner = createToolRunner(options.resolveWorktree);
    this.#toolRunner = createScenarioToolRunner(
      realToolRunner,
      scenarioId ? getMockScenario(scenarioId) : null,
    );
    this.#state = new AiConversationState({
      projectId: options.projectId,
      repository: options.repository,
      record: options.record,
      adapterKind: this.#scenarioBackend?.adapterKind ?? options.initialAdapterKind,
      model: this.#scenarioBackend?.model ?? options.initialModel,
      selectedModelId: options.selectedModelId ?? "",
      selectedAgentId: options.selectedAgentId ?? "builtin-writing-assistant",
      scenarioId: this.#scenarioBackend?.scenarioId ?? null,
      persistence: options.persistence ?? "persistent",
    });
    const pendingToolBatch = this.#state.pendingToolBatch;
    if (pendingToolBatch && pendingToolBatch.pendingInputs.length > 0) {
      void this.#awaitPendingInputs(pendingToolBatch);
    }
  }

  get conversationId(): string {
    return this.#state.conversationId;
  }

  get persisted(): boolean {
    return this.#state.persisted;
  }

  get isPureDraft(): boolean {
    return this.#state.isPureDraft;
  }

  get persistence(): MockScenarioPersistence {
    return this.#state.persistence;
  }

  get selectedAgentId(): string {
    return this.#state.selectedAgentId;
  }

  get selectedModelId(): string {
    return this.#state.selectedModelId;
  }

  setSelectedModel(modelId: string, adapterKind: AiChatSelectableModelKind, model: string): void {
    if (this.#state.selectedModelId === modelId) {
      return;
    }
    if (this.#state.pending || this.#state.pendingToolBatch !== null) {
      throw new Error("AI 请求处理中，无法切换模型。");
    }
    this.#state.setSelectedModelId(modelId);
    this.#state.setBackend(adapterKind, model);
    this.#state.persistIfNeeded();
    this.#emit({
      kind: "delta",
      ops: [
        {
          type: "state.updated",
          patch: {
            selectedModelId: modelId,
            adapterKind,
            model,
          },
        },
      ],
    });
  }

  setSelectedAgent(
    agentId: string,
    modelId: string,
    adapterKind: AiChatSelectableModelKind,
    model: string,
  ): void {
    if (this.#state.selectedAgentId === agentId) {
      return;
    }
    if (this.#state.pending || this.#state.pendingToolBatch !== null) {
      throw new Error("AI 请求处理中，无法切换 Agent。");
    }
    this.#state.setSelectedAgentId(agentId);
    this.#state.setSelectedModelId(modelId);
    this.#state.setBackend(adapterKind, model);
    this.#state.persistIfNeeded();
    this.#emit({
      kind: "delta",
      ops: [
        {
          type: "state.updated",
          patch: {
            selectedAgentId: agentId,
            selectedModelId: modelId,
            adapterKind,
            model,
          },
        },
      ],
    });
  }

  subscribe(): ReadableStream<AiChatEvent> {
    return this.#publisher.subscribe({
      getInitialValue: () => ({
        kind: "snapshot",
        snapshot: this.#state.getSnapshot(),
      }),
    });
  }

  addEventListener(listener: RuntimeEventListener): () => void {
    this.#eventListeners.add(listener);
    return () => {
      this.#eventListeners.delete(listener);
    };
  }

  getSnapshot(): AiChatSnapshot {
    return this.#state.getSnapshot();
  }

  getSummary(): AiConversationSummary {
    return this.#state.getSummary();
  }

  touchLastActive(): void {
    this.#state.touchLastActive();
  }

  persistIfNeeded(): void {
    this.#state.persistIfNeeded();
  }

  sendMessage(text: string): void {
    const normalized = text.trim();
    if (normalized === "") {
      throw new Error("AI 消息不能为空。");
    }
    if (this.#state.pending) {
      throw new Error("AI 请求仍在处理中。");
    }
    if (this.#state.pendingToolBatch !== null) {
      throw new Error("AI 正在等待当前工具步骤的用户回答。");
    }

    const userMessage = this.#state.appendUserMessage(normalized);
    const assistantMessage = this.#state.appendAssistantMessage();
    const requestInput = [...this.#state.history, toInputItem(userMessage.text)];

    this.#state.setPending(true);
    this.#state.setErrorMessage(null);
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

  stopGeneration(): void {
    if (this.#disposed || !this.#state.pending) {
      return;
    }
    this.#generationAbort?.abort();
  }

  [Symbol.dispose](): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.#generationAbort?.abort();
    this.#generationAbort = null;
    try {
      this.#state.persistIfNeeded();
    } finally {
      this.#eventListeners.clear();
      this.#publisher[Symbol.dispose]();
    }
  }

  async #consumeStream(
    stream: AsyncIterable<AIStreamEvent>,
    assistantMessageId: string,
  ): Promise<AIResponse> {
    const events: AIStreamEvent[] = [];
    for await (const event of stream) {
      this.#emitDelta(this.#state.handleStreamEvent(event, assistantMessageId));
      events.push(event);
    }
    return aggregateEvents(events);
  }

  async #runRequest(context: {
    assistantMessageId: string;
    requestInput: InputItem[];
    transcript?: InputItem[];
    backend?: AiBackendSession;
    usage?: AiChatMessageUsage | null;
  }): Promise<void> {
    let input = [...context.requestInput];
    const transcript = context.transcript ? [...context.transcript] : [...context.requestInput];
    let completedResponse: AIResponse | null = null;
    let toolRoundCount = 0;
    let usage = context.usage ?? null;
    const abortController = new AbortController();
    this.#generationAbort = abortController;
    const { signal } = abortController;

    try {
      const backend = context.backend ?? this.#resolveBackend();
      this.#activeBackend = backend;
      this.#state.setBackend(backend.adapterKind, backend.model);
      this.#emitDelta([
        {
          type: "state.updated",
          patch: {
            adapterKind: backend.adapterKind,
            model: backend.model,
          },
        },
      ]);

      const agentConfig = this.#scenarioBackend
        ? null
        : this.#resolveAgentConfig(this.#state.selectedAgentId);
      const resolvedTools =
        agentConfig && agentConfig.availableToolNames.length < Object.keys(AI_TOOLS_MAP).length
          ? AI_TOOLS.filter((tool) => agentConfig.availableToolNames.includes(tool.name))
          : AI_TOOLS;

      while (true) {
        if (signal.aborted) {
          throw new DOMException("AI generation stopped by user.", "AbortError");
        }

        const streamStartPartCount = this.#state.countAssistantParts(context.assistantMessageId);
        completedResponse = await this.#consumeStream(
          backend.client.stream({
            instructions: backend.instructions,
            input,
            tools: resolvedTools,
            signal,
            ...(backend.maxOutputTokens !== undefined
              ? { maxOutputTokens: backend.maxOutputTokens }
              : {}),
          }),
          context.assistantMessageId,
        );

        this.#emitDelta(
          this.#state.reconcileAssistantResponse(
            context.assistantMessageId,
            streamStartPartCount,
            completedResponse,
          ),
        );
        transcript.push(...completedResponse.replay);
        usage = addMessageUsage(usage, completedResponse.usage);
        this.#emitDelta(
          this.#state.updateMessage(context.assistantMessageId, {
            usage,
          }),
        );

        if (!shouldProcessToolCalls(completedResponse)) {
          break;
        }

        if (signal.aborted) {
          throw new DOMException("AI generation stopped by user.", "AbortError");
        }

        toolRoundCount += 1;
        if (toolRoundCount > MAX_TOOL_ROUNDS) {
          throw new Error(`AI 工具循环超过 ${MAX_TOOL_ROUNDS} 轮。`);
        }

        input = [...input, ...completedResponse.replay];
        const batchOutcome = await this.#processToolBatch(
          context.assistantMessageId,
          completedResponse.toolCalls,
          input,
          transcript,
          backend,
          usage,
        );
        if (batchOutcome === "paused") {
          this.#state.persistIfNeeded();
          return;
        }
      }

      if (completedResponse === null) {
        throw new Error("AI 流在完成前结束。");
      }

      this.#emitDelta(
        this.#state.updateMessage(context.assistantMessageId, { status: "complete" }),
      );
      this.#state.replaceHistory(transcript);
      this.#state.setPendingToolBatch(null);
      this.#state.setPending(false);
      this.#emitDelta([
        {
          type: "state.updated",
          patch: {
            pending: false,
            pendingUserInputs: [],
          },
        },
      ]);
      this.#state.persistIfNeeded();
      this.#activeBackend = null;
    } catch (error) {
      const stopped = isAbortError(error) || signal.aborted;
      this.#state.setPending(false);
      this.#state.setPendingToolBatch(null);
      if (!stopped) {
        this.#state.setErrorMessage(toErrorMessage(error));
      } else {
        this.#state.setErrorMessage(null);
      }
      const ops: AiChatDeltaOp[] = [];

      if (this.#state.countAssistantParts(context.assistantMessageId) === 0) {
        ops.push(...this.#state.removeMessage(context.assistantMessageId));
        // Keep the user turn in history so the next send does not drop it.
        this.#state.replaceHistory(transcript);
      } else {
        const partialHistory = incompleteAssistantPartsToHistoryItems(
          this.#state,
          context.assistantMessageId,
        );
        ops.push(...this.#state.updateMessage(context.assistantMessageId, { status: "complete" }));
        ops.push(...this.#state.completeStreamingAssistantParts(context.assistantMessageId));
        this.#state.replaceHistory([...transcript, ...partialHistory]);
      }

      ops.push({
        type: "state.updated",
        patch: {
          pending: false,
          pendingUserInputs: [],
          errorMessage: stopped ? null : toErrorMessage(error),
        },
      });
      this.#emitDelta(ops);
      this.#state.persistIfNeeded();
      this.#activeBackend = null;
    } finally {
      if (this.#generationAbort === abortController) {
        this.#generationAbort = null;
      }
    }
  }

  async #processToolBatch(
    assistantMessageId: string,
    calls: ToolCallItem[],
    input: InputItem[],
    transcript: InputItem[],
    backend: AiBackendSession,
    usage: AiChatMessageUsage | null,
  ): Promise<"continue" | "paused"> {
    const resolvedResultsByCallId = new Map<string, ToolResultItem>();
    const pendingInputs: PendingToolBatch["pendingInputs"] = [];

    for (const call of calls) {
      this.#emitDelta(
        this.#state.updateAssistantPart(assistantMessageId, call.id, {
          status: "running",
        }),
      );

      const execution = await this.#toolRunner.execute(call);
      if (execution.userInputRequest) {
        const pending = createPendingUserInputFromRequest(call, execution.userInputRequest);
        this.#emitDelta(
          this.#state.updateAssistantPart(assistantMessageId, call.id, {
            status: "awaiting_user",
            resultText: null,
            errorMessage: null,
          }),
        );
        pendingInputs.push(pending);
        continue;
      }

      this.#emitDelta(
        this.#state.updateAssistantPart(assistantMessageId, call.id, {
          status: execution.errorMessage === null ? "complete" : "error",
          resultText: execution.resultText,
          errorMessage: execution.errorMessage,
        }),
      );
      resolvedResultsByCallId.set(call.id, execution.toolResult);
    }

    if (pendingInputs.length > 0) {
      this.#state.setPending(false);
      const batch: PendingToolBatch = {
        assistantMessageId,
        calls,
        input: [...input],
        transcript: [...transcript],
        resolvedResultsByCallId,
        pendingInputs,
        usage,
      };
      this.#state.setPendingToolBatch(batch);
      this.#emitDelta([
        {
          type: "state.updated",
          patch: {
            pending: false,
            pendingUserInputs: pendingInputs.map((entry) => entry.pending),
            errorMessage: null,
          },
        },
      ]);
      void this.#awaitPendingInputs(batch, backend);
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

  async #awaitPendingInputs(
    batch: PendingToolBatch,
    backend = this.#activeBackend ?? this.#resolveBackend(),
  ): Promise<void> {
    const results = await Promise.all(batch.pendingInputs.map((entry) => entry.resolverPromise));

    if (this.#state.pendingToolBatch !== batch || this.#disposed) {
      return;
    }

    for (let i = 0; i < batch.pendingInputs.length; i++) {
      const entry = batch.pendingInputs[i]!;
      const result = results[i]!;
      batch.resolvedResultsByCallId.set(entry.callId, result);
      this.#emitDelta(
        this.#state.updateAssistantPart(batch.assistantMessageId, entry.callId, {
          status: "complete",
          resultText: joinContentBlocksText(result.content),
          errorMessage: null,
        }),
      );
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

    this.#state.setPendingToolBatch(null);
    this.#state.setPending(true);
    this.#state.setErrorMessage(null);
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
    this.#state.persistIfNeeded();

    void this.#runRequest({
      assistantMessageId: batch.assistantMessageId,
      requestInput: input,
      transcript,
      backend,
      usage: batch.usage,
    });
  }

  #resolveBackend(): AiBackendSession {
    if (this.#scenarioBackend) {
      return this.#scenarioBackend;
    }

    const selectedModelId = this.#state.selectedModelId;
    if (selectedModelId === "mock") {
      return createAiBackendSession({ clientLabel: this.#clientLabel });
    }

    const modelConfig = this.#resolveModelConfig(selectedModelId);
    if (!modelConfig) {
      throw new Error("所选 AI 模型不存在或已被删除，请重新选择模型。");
    }
    const agentConfig = this.#resolveAgentConfig(this.#state.selectedAgentId);
    return createAiBackendSession({
      clientLabel: this.#clientLabel,
      modelConfig,
      instructionsOverride: agentConfig.systemPrompt,
    });
  }

  #emit(event: AiChatEvent): void {
    this.#publisher.emit(event);
    for (const listener of this.#eventListeners) {
      listener(event);
    }
  }

  #emitDelta(ops: AiChatDeltaOp[]): void {
    if (ops.length === 0) {
      return;
    }

    this.#emit({
      kind: "delta",
      ops,
    });
  }
}
