import type {
  AIClient,
  AIResponse,
  AIStreamEvent,
  InputItem,
  ToolCallItem,
  ToolResultItem,
} from "@codehz/ai";

import { cloneAiChatMessage } from "#shared/rpc/ai-chat-state";
import type {
  AiChatDeltaOp,
  AiChatEvent,
  AiChatSnapshot,
  AiConversationSummary,
} from "#shared/rpc/ai-rpc";

import type { AiChatRepository, AiConversationRecord } from "../../db/repositories/ai-chat-repo";
import { RpcStreamPublisher } from "../../lib/stream-publisher";
import { joinContentBlocksText, toErrorMessage } from "../ai-utils";
import { AI_INSTRUCTIONS, createMockClient, toInputItem } from "../mock-adapter";
import { AI_TOOLS } from "../tools/definitions";
import { createToolRunner, type ResolveWorktree, type ToolRunner } from "../tools/runner";
import { AiConversationState } from "./conversation-state";
import { createPendingUserInputFromRequest, type PendingToolBatch } from "./pending-tool-batch";

type RuntimeEventListener = (event: AiChatEvent) => void;

export type AiConversationRuntimeOptions = {
  projectId: number;
  repository: AiChatRepository;
  resolveWorktree: ResolveWorktree;
  clientLabel?: string;
  record?: AiConversationRecord | null;
};

export class AiConversationRuntime {
  readonly #client: AIClient;
  readonly #toolRunner: ToolRunner;
  readonly #publisher = new RpcStreamPublisher<AiChatEvent>();
  readonly #eventListeners = new Set<RuntimeEventListener>();
  readonly #state: AiConversationState;
  #disposed = false;

  constructor(options: AiConversationRuntimeOptions) {
    this.#client = createMockClient(options.clientLabel ?? `project-${options.projectId}`);
    this.#toolRunner = createToolRunner(options.resolveWorktree);
    this.#state = new AiConversationState({
      projectId: options.projectId,
      repository: options.repository,
      record: options.record,
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

  [Symbol.dispose](): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
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
    let completedResponse: AIResponse | null = null;

    for await (const event of stream) {
      this.#emitDelta(this.#state.handleStreamEvent(event, assistantMessageId));
      if (event.type === "response.completed") {
        completedResponse = event.response;
      }
    }

    if (completedResponse === null) {
      throw new Error("AI 流在完成前结束。");
    }

    return completedResponse;
  }

  async #runRequest(context: {
    assistantMessageId: string;
    requestInput: InputItem[];
    transcript?: InputItem[];
  }): Promise<void> {
    let input = [...context.requestInput];
    const transcript = context.transcript ? [...context.transcript] : [...context.requestInput];
    let completedResponse: AIResponse | null = null;

    try {
      while (true) {
        const streamStartPartCount = this.#state.countAssistantParts(context.assistantMessageId);
        completedResponse = await this.#consumeStream(
          this.#client.stream({
            instructions: AI_INSTRUCTIONS,
            input,
            tools: AI_TOOLS,
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

        if (
          completedResponse.stopReason !== "tool_call" ||
          completedResponse.toolCalls.length === 0
        ) {
          break;
        }

        input = [...input, ...completedResponse.replay];
        const batchOutcome = await this.#processToolBatch(
          context.assistantMessageId,
          completedResponse.toolCalls,
          input,
          transcript,
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
        this.#state.updateMessage(
          context.assistantMessageId,
          this.#state.buildCompletionPatch(completedResponse),
        ),
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
    } catch (error) {
      this.#state.setPending(false);
      this.#state.setPendingToolBatch(null);
      this.#state.setErrorMessage(toErrorMessage(error));
      const ops: AiChatDeltaOp[] = [];

      if (this.#state.countAssistantParts(context.assistantMessageId) === 0) {
        ops.push(...this.#state.removeMessage(context.assistantMessageId));
      } else {
        ops.push(...this.#state.updateMessage(context.assistantMessageId, { status: "complete" }));
        ops.push(...this.#state.completeStreamingAssistantParts(context.assistantMessageId));
      }

      ops.push({
        type: "state.updated",
        patch: {
          pending: false,
          pendingUserInputs: [],
          errorMessage: toErrorMessage(error),
        },
      });
      this.#emitDelta(ops);
      this.#state.persistIfNeeded();
    }
  }

  async #processToolBatch(
    assistantMessageId: string,
    calls: ToolCallItem[],
    input: InputItem[],
    transcript: InputItem[],
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
      void this.#awaitPendingInputs(batch);
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

  async #awaitPendingInputs(batch: PendingToolBatch): Promise<void> {
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
