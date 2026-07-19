import type {
  AIResponse,
  AIStreamEvent,
  InputItem,
  ToolCallItem,
  ToolResultItem,
} from "@codehz/ai";
import { aggregateEvents } from "@codehz/ai";

import { cloneAiChatMessage, MOCK_AI_MODEL_ID } from "#shared/rpc/ai/index";
import type {
  AiChatMessageUsage,
  AiChatSelectableModelKind,
  AiChatDeltaOp,
  AiChatEvent,
  AiChatSendMessageInput,
  AiChatSnapshot,
  AiConversationStatus,
  AiConversationSummary,
} from "#shared/rpc/ai/index";
import { isAiReasoningLevel, type AiReasoningLevel } from "#shared/rpc/services/index";

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
  type ToolExecutionResult,
  type ToolRunner,
} from "../tools";
import { AiConversationState } from "./conversation-state";
import { expandMentionsForModel } from "./mention-expand";
import { createPendingUserInputFromRequest, type PendingToolBatch } from "./pending-tool-batch";
import { countCommittedAssistantParts, rebuildLastRequestInput } from "./request-history";
import { resolveReasoningLevelForModel } from "./selectable-models";
import { expandSlashForModel } from "./slash-expand";
import { executeSubagentToolCall, RUN_SUBAGENT_TOOL_NAME } from "./subagent";

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
  /**
   * Initial session reasoning effort (already validated against the selected model).
   * When loading a record, prefer this over the raw stored value if provided.
   */
  selectedReasoningLevel?: AiReasoningLevel | null;
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

export class AiConversationRuntime {
  readonly #toolRunner: ToolRunner;
  readonly #resolveWorktree: ResolveWorktree;
  readonly #publisher = new RpcStreamPublisher<AiChatEvent>();
  readonly #eventListeners = new Set<RuntimeEventListener>();
  readonly #state: AiConversationState;
  readonly #clientLabel: string;
  readonly #resolveModelConfig: AiConversationRuntimeOptions["resolveModelConfig"];
  readonly #resolveAgentConfig: AiConversationRuntimeOptions["resolveAgentConfig"];
  readonly #scenarioBackend: AiBackendSession | null;
  readonly #scenarioPacing: MockScenarioPacing | undefined;
  #activeBackend: AiBackendSession | null = null;
  #generationAbort: AbortController | null = null;
  #disposed = false;

  constructor(options: AiConversationRuntimeOptions) {
    const scenarioId = options.record?.scenarioId ?? options.scenarioId ?? null;
    this.#clientLabel = options.clientLabel ?? `project-${options.projectId}`;
    this.#resolveModelConfig = options.resolveModelConfig;
    this.#resolveAgentConfig = options.resolveAgentConfig;
    this.#resolveWorktree = options.resolveWorktree;
    this.#scenarioPacing = options.pacing;
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
    const selectedModelId = options.selectedModelId ?? options.record?.selectedModelId ?? "";
    const preferredFromRecord = (() => {
      const raw = options.record?.selectedReasoningLevel?.trim() ?? "";
      return isAiReasoningLevel(raw) ? raw : null;
    })();
    const selectedReasoningLevel =
      options.selectedReasoningLevel !== undefined
        ? options.selectedReasoningLevel
        : this.#resolveReasoningLevelForModelId(selectedModelId, preferredFromRecord);
    this.#state = new AiConversationState({
      projectId: options.projectId,
      repository: options.repository,
      record: options.record,
      adapterKind: this.#scenarioBackend?.adapterKind ?? options.initialAdapterKind,
      model: this.#scenarioBackend?.model ?? options.initialModel,
      selectedModelId,
      selectedAgentId: options.selectedAgentId ?? "builtin-writing-assistant",
      selectedReasoningLevel,
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

  get selectedReasoningLevel(): AiReasoningLevel | null {
    return this.#state.selectedReasoningLevel;
  }

  setSelectedModel(modelId: string, adapterKind: AiChatSelectableModelKind, model: string): void {
    if (this.#state.selectedModelId === modelId) {
      return;
    }
    if (this.#state.pending || this.#state.pendingToolBatch !== null) {
      throw new Error("AI 请求处理中，无法切换模型。");
    }
    const selectedReasoningLevel = this.#resolveReasoningLevelForModelId(modelId, null);
    this.#state.setSelectedModelId(modelId);
    this.#state.setBackend(adapterKind, model);
    this.#state.setSelectedReasoningLevel(selectedReasoningLevel);
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
            selectedReasoningLevel,
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
    const selectedReasoningLevel = this.#resolveReasoningLevelForModelId(modelId, null);
    this.#state.setSelectedAgentId(agentId);
    this.#state.setSelectedModelId(modelId);
    this.#state.setBackend(adapterKind, model);
    this.#state.setSelectedReasoningLevel(selectedReasoningLevel);
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
            selectedReasoningLevel,
          },
        },
      ],
    });
  }

  setSelectedReasoningLevel(level: AiReasoningLevel | null): void {
    if (this.#state.selectedReasoningLevel === level) {
      return;
    }
    if (this.#state.pending || this.#state.pendingToolBatch !== null) {
      throw new Error("AI 请求处理中，无法切换推理强度。");
    }

    const modelConfig = this.#resolveModelConfig(this.#state.selectedModelId);
    const available = modelConfig?.availableReasoningLevels ?? [];
    if (level === null) {
      if (available.length > 0) {
        throw new Error("当前模型需要选择推理强度档位。");
      }
    } else if (!available.includes(level)) {
      throw new Error("所选推理强度对当前模型不可用。");
    }

    this.#state.setSelectedReasoningLevel(level);
    this.#state.persistIfNeeded();
    this.#emit({
      kind: "delta",
      ops: [
        {
          type: "state.updated",
          patch: {
            selectedReasoningLevel: level,
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

  get status(): AiConversationStatus {
    return this.#state.status;
  }

  collectSearchableTexts(): string[] {
    return this.#state.collectSearchableTexts();
  }

  persistIfNeeded(): void {
    this.#state.persistIfNeeded();
  }

  discard(): void {
    this.#state.discard();
  }

  rename(title: string): void {
    this.#state.rename(title);
  }

  setStatus(status: AiConversationStatus): void {
    this.#state.setStatus(status);
  }

  sendMessage(input: AiChatSendMessageInput): void {
    const slash = input.slash ?? null;
    const text = typeof input.text === "string" ? input.text : "";
    const mentions = input.mentions ?? [];
    // Display form keeps slash remainder + mention tokens; expand only for the model.
    const modelText = expandMentionsForModel(expandSlashForModel(slash, text), mentions);
    if (modelText === "") {
      throw new Error("AI 消息不能为空。");
    }
    if (this.#state.pending) {
      throw new Error("AI 请求仍在处理中。");
    }
    if (this.#state.pendingToolBatch !== null) {
      throw new Error("AI 正在等待当前工具步骤的用户回答。");
    }

    // Persist display form (slash chip + remainder + mention tokens); expand only into model history.
    const userMessage = this.#state.appendUserMessage({ text, slash, mentions });
    const assistantMessage = this.#state.appendAssistantMessage(this.#resolveSelectedModelName());
    const requestInput = [...this.#state.history, toInputItem(modelText)];

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
          canRetry: false,
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

  /**
   * Switch sibling branch for messageId to index; emit path.replaced.
   */
  selectMessageBranch(messageId: string, index: number): void {
    if (this.#disposed) {
      return;
    }
    if (this.#state.pending || this.#state.pendingToolBatch !== null) {
      return;
    }
    if (!this.#state.selectMessageBranch(messageId, index)) {
      return;
    }
    this.#state.setErrorMessage(null);
    this.#emitDelta([
      {
        type: "path.replaced",
        messages: this.#state.projectActivePathMessages(),
      },
      {
        type: "state.updated",
        patch: {
          errorMessage: null,
          canRetry: this.#state.canRetry,
        },
      },
    ]);
    this.#state.persistIfNeeded();
  }

  /**
   * Edit a historical user message: sibling user + new assistant turn generation.
   * Original branch retained.
   */
  editUserMessage(messageId: string, input: AiChatSendMessageInput): void {
    if (this.#disposed) {
      return;
    }
    if (this.#state.pending || this.#state.pendingToolBatch !== null) {
      return;
    }

    const slash = input.slash ?? null;
    const text = typeof input.text === "string" ? input.text : "";
    const mentions = input.mentions ?? [];
    const modelText = expandMentionsForModel(expandSlashForModel(slash, text), mentions);
    if (modelText === "") {
      throw new Error("AI 消息不能为空。");
    }

    const userMessage = this.#state.editUserMessage(messageId, { text, slash, mentions });
    if (!userMessage) {
      throw new Error("只能编辑用户消息。");
    }

    const assistantMessage = this.#state.appendAssistantMessage(this.#resolveSelectedModelName());
    // History for the new path: prior nodes + new user item (user node history filled on complete).
    const requestInput = [...this.#state.history, toInputItem(modelText)];

    this.#state.setPending(true);
    this.#state.setErrorMessage(null);
    this.#emitDelta([
      {
        type: "path.replaced",
        messages: this.#state.projectActivePathMessages(),
      },
      {
        type: "state.updated",
        patch: {
          pending: true,
          errorMessage: null,
          canRetry: false,
        },
      },
    ]);

    void this.#runRequest({
      assistantMessageId: assistantMessage.id,
      requestInput,
    });
  }

  /**
   * Regenerate last assistant as a new sibling under the same parent user.
   * Previous assistant versions stay on the tree (‹n/m›). requestInput is rebuilt
   * from history last-request boundary without rewriting old nodes.
   */
  retryLastRequest(): void {
    if (this.#disposed || !this.#state.canRetry) {
      return;
    }

    const requestInput = rebuildLastRequestInput(this.#state.history);
    if (requestInput.length === 0) {
      return;
    }

    const previousAssistant = this.#state.lastAssistantMessage;
    const assistantMessage = this.#state.appendAssistantMessage(this.#resolveSelectedModelName());

    // Clear warnings on the previous leaf if present (new sibling starts clean).
    if (previousAssistant) {
      this.#state.clearWarningsForMessage(previousAssistant.id);
    }

    this.#state.setPending(true);
    this.#state.setErrorMessage(null);
    this.#emitDelta([
      {
        type: "path.replaced",
        messages: this.#state.projectActivePathMessages(),
      },
      {
        type: "state.updated",
        patch: {
          pending: true,
          errorMessage: null,
          canRetry: false,
        },
      },
    ]);

    void this.#runRequest({
      assistantMessageId: assistantMessage.id,
      requestInput,
    });
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
            ...(this.#state.selectedReasoningLevel != null
              ? { reasoningLevel: this.#state.selectedReasoningLevel }
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
            canRetry: this.#state.canRetry,
          },
        },
      ]);
      this.#state.persistIfNeeded();
      this.#activeBackend = null;
    } catch (error) {
      const stopped = isAbortError(error) || signal.aborted;
      this.#state.setPending(false);
      this.#state.setPendingToolBatch(null);
      const errorMessage = stopped ? null : toErrorMessage(error);
      this.#state.setErrorMessage(errorMessage);

      // Drop dangling model output (e.g. tool_calls without results) so history stays a valid
      // request prefix for send/retry — same boundary rebuildLastRequestInput uses.
      const committedHistory = rebuildLastRequestInput(transcript);
      this.#state.replaceHistory(committedHistory);

      const ops: AiChatDeltaOp[] = [];
      // Drop uncommitted last-request parts; keep completed tool rounds visible.
      const assistant = this.#state.lastAssistantMessage;
      if (assistant && assistant.id === context.assistantMessageId) {
        const keepCount = countCommittedAssistantParts(assistant.parts, committedHistory);
        ops.push(...this.#state.truncateAssistantParts(assistant.id, keepCount));
        ops.push(
          ...this.#state.updateMessage(assistant.id, {
            status: "complete",
          }),
        );
      }

      ops.push({
        type: "state.updated",
        patch: {
          pending: false,
          pendingUserInputs: [],
          errorMessage,
          canRetry: this.#state.canRetry,
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

      const execution =
        call.name === RUN_SUBAGENT_TOOL_NAME
          ? await this.#executeSubagent(assistantMessageId, call)
          : await this.#toolRunner.execute(call);
      if (execution.userInputRequest) {
        const pending = createPendingUserInputFromRequest(call, execution.userInputRequest);
        this.#emitDelta(
          this.#state.updateAssistantPart(assistantMessageId, call.id, {
            status: "awaiting_user",
            resultText: null,
            errorMessage: null,
            view: execution.view,
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
          view: execution.view,
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
            canRetry: false,
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

  async #executeSubagent(
    assistantMessageId: string,
    call: ToolCallItem,
  ): Promise<ToolExecutionResult> {
    const signal = this.#generationAbort?.signal ?? new AbortController().signal;
    const scenarioId = this.#scenarioBackend?.scenarioId ?? null;
    return executeSubagentToolCall({
      call,
      depth: 0,
      signal,
      deps: {
        resolveAgentConfig: (agentId) => this.#resolveAgentConfig(agentId),
        resolveModelConfig: (modelId) => this.#resolveModelConfig(modelId),
        resolveWorktree: this.#resolveWorktree,
        clientLabel: this.#clientLabel,
        parentSelectedModelId: this.#state.selectedModelId,
        parentSelectedReasoningLevel: this.#state.selectedReasoningLevel,
        parentAdapterKind: this.#state.getSnapshot().adapterKind,
        scenarioId,
        scenarioPacing: this.#scenarioPacing,
        // Share the parent scenario tool runner so simulated child tool results apply.
        toolRunner: this.#toolRunner,
      },
      onView: (view) => {
        if (this.#disposed || signal.aborted) {
          return;
        }
        // UI-only live view; never forwarded to the model.
        this.#emitDelta(
          this.#state.updateAssistantPart(assistantMessageId, call.id, {
            view,
          }),
        );
      },
    });
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
          canRetry: false,
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

  #resolveReasoningLevelForModelId(
    modelId: string,
    preferred: AiReasoningLevel | null,
  ): AiReasoningLevel | null {
    if (modelId === "" || modelId === "mock") {
      return null;
    }
    return resolveReasoningLevelForModel(this.#resolveModelConfig(modelId), preferred);
  }

  /** Config display name for the active session model (matches selector `name`). */
  #resolveSelectedModelName(): string {
    const modelId = this.#state.selectedModelId;
    if (modelId === MOCK_AI_MODEL_ID) {
      return "Mock AI";
    }
    const configName = this.#resolveModelConfig(modelId)?.name?.trim() ?? "";
    if (configName !== "") {
      return configName;
    }
    return this.getSnapshot().model || "";
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
