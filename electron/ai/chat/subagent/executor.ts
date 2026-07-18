import type {
  AIResponse,
  AIStreamEvent,
  InputItem,
  ToolCallItem,
  ToolDefinition,
} from "@codehz/ai";
import { aggregateEvents } from "@codehz/ai";

import type { AiChatMessageUsage, AiChatSelectableModelKind } from "#shared/rpc/ai/index";
import { MOCK_AI_MODEL_ID } from "#shared/rpc/ai/index";
import type { AiReasoningLevel } from "#shared/rpc/services/index";

import type { AiAgentRuntimeConfig } from "../../../settings/ai-agents-store";
import type { AiModelRuntimeConfig } from "../../../settings/ai-models-store";
import {
  addMessageUsage,
  contentBlockToDisplayText,
  readResponseText,
  toErrorMessage,
} from "../../ai-utils";
import type { AiBackendSession } from "../../backend/ai-backend-session";
import { createAiBackendSession } from "../../backend/create-ai-backend";
import { toInputItem } from "../../mock-adapter";
import {
  createToolRunner,
  selectAiTools,
  type ResolveWorktree,
  type ToolExecutionResult,
  type ToolRunner,
} from "../../tools";
import { okJson } from "../../tools/result";
import { buildSubagentUserMessage, parseRunSubagentArgs } from "./context";
import { resolveFocusSnapshots } from "./focus-inject";
import {
  assertSubagentDepth,
  MAX_SUBAGENT_TOOL_ROUNDS,
  resolveSubagentModelId,
  RUN_SUBAGENT_TOOL_NAME,
  stripSubagentTools,
} from "./policy";
import {
  buildSubagentProgress,
  createProgressThrottle,
  type SubagentProgress,
  type SubagentProgressPhase,
  type SubagentProgressTool,
} from "./progress";
import {
  abortedSubagentResult,
  collectArtifactsFromToolCall,
  completedSubagentResult,
  failedSubagentResult,
  type SubagentArtifacts,
  type SubagentRunResult,
} from "./result";

export type SubagentExecutorDeps = {
  resolveAgentConfig: (agentId: string) => AiAgentRuntimeConfig | null;
  resolveModelConfig: (modelId: string) => AiModelRuntimeConfig | null;
  resolveWorktree: ResolveWorktree;
  clientLabel: string;
  parentSelectedModelId: string;
  parentSelectedReasoningLevel: AiReasoningLevel | null;
  parentAdapterKind: AiChatSelectableModelKind;
  /** Optional override for tests. */
  toolRunner?: ToolRunner;
  /** Optional override for tests. */
  createBackend?: (options: { agent: AiAgentRuntimeConfig; modelId: string }) => AiBackendSession;
};

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  return error instanceof Error && error.name === "AbortError";
}

function emptyArtifacts(): SubagentArtifacts {
  return { touched_node_ids: [], wrote: false };
}

function toToolExecution(call: ToolCallItem, result: SubagentRunResult): ToolExecutionResult {
  return okJson(call, result);
}

function resolveBackend(
  deps: SubagentExecutorDeps,
  agent: AiAgentRuntimeConfig,
  modelId: string,
): AiBackendSession {
  if (deps.createBackend) {
    return deps.createBackend({ agent, modelId });
  }

  if (modelId === "" || modelId === MOCK_AI_MODEL_ID || deps.parentAdapterKind === "mock") {
    return createAiBackendSession({
      clientLabel: `${deps.clientLabel}/subagent/${agent.id}`,
      instructionsOverride: agent.systemPrompt,
    });
  }

  const modelConfig = deps.resolveModelConfig(modelId);
  if (!modelConfig) {
    throw new Error(`子代理模型「${modelId}」不可用。`);
  }

  return createAiBackendSession({
    clientLabel: `${deps.clientLabel}/subagent/${agent.id}`,
    modelConfig,
    instructionsOverride: agent.systemPrompt,
  });
}

type ProgressReporter = {
  emit: (
    phase: SubagentProgressPhase,
    overrides?: {
      currentTool?: SubagentProgressTool | null;
    },
  ) => void;
  setPartialSummary: (text: string) => void;
  pushRecentTool: (tool: SubagentProgressTool) => void;
  setArtifacts: (artifacts: SubagentArtifacts) => void;
  forceFlush: () => void;
  cancel: () => void;
  bumpRound: () => number;
};

function createProgressReporter(options: {
  agentId: string;
  agentName: string;
  onProgress?: (progress: SubagentProgress) => void;
}): ProgressReporter {
  let round = 0;
  let partialSummary = "";
  let currentTool: SubagentProgressTool | null = null;
  let recentTools: SubagentProgressTool[] = [];
  let artifacts = emptyArtifacts();
  let phase: SubagentProgressPhase = "starting";

  const build = (nextPhase: SubagentProgressPhase): SubagentProgress =>
    buildSubagentProgress({
      agentId: options.agentId,
      agentName: options.agentName,
      phase: nextPhase,
      round,
      maxRounds: MAX_SUBAGENT_TOOL_ROUNDS,
      currentTool,
      recentTools,
      partialSummary,
      wrote: artifacts.wrote,
      touchedCount: artifacts.touched_node_ids.length,
    });

  const emitRaw = (progress: SubagentProgress) => {
    options.onProgress?.(progress);
  };

  const throttle = createProgressThrottle({
    onEmit: emitRaw,
  });

  return {
    emit(nextPhase, overrides) {
      phase = nextPhase;
      if (overrides && "currentTool" in overrides) {
        currentTool = overrides.currentTool ?? null;
      }
      throttle.forceFlush();
      emitRaw(build(phase));
    },
    setPartialSummary(text) {
      partialSummary = text;
      throttle.schedule(build(phase === "starting" ? "thinking" : phase));
    },
    pushRecentTool(tool) {
      recentTools = [...recentTools, tool];
      currentTool = null;
    },
    setArtifacts(next) {
      artifacts = next;
    },
    forceFlush() {
      throttle.forceFlush();
    },
    cancel() {
      throttle.cancel();
    },
    bumpRound() {
      round += 1;
      return round;
    },
  };
}

async function consumeStreamWithProgress(
  stream: AsyncIterable<AIStreamEvent>,
  signal: AbortSignal,
  onMessageDelta: (fullText: string) => void,
): Promise<AIResponse> {
  const events: AIStreamEvent[] = [];
  let partialText = "";

  for await (const event of stream) {
    if (signal.aborted) {
      throw new DOMException("AI generation stopped by user.", "AbortError");
    }
    events.push(event);

    if (event.type === "message.delta") {
      const chunk = contentBlockToDisplayText(event.delta);
      if (chunk !== "") {
        partialText += chunk;
        onMessageDelta(partialText);
      }
    }
  }

  return aggregateEvents(events);
}

/**
 * Run an isolated specialist agent for a single `run_subagent` tool call.
 * Intermediate UI progress is delivered only via `onProgress` (not parent history parts).
 */
export async function executeSubagentToolCall(options: {
  call: ToolCallItem;
  depth: number;
  signal: AbortSignal;
  deps: SubagentExecutorDeps;
  /** Optional UI progress sink (serialized by the runtime into `progressText`). */
  onProgress?: (progress: SubagentProgress) => void;
}): Promise<ToolExecutionResult> {
  const { call, depth, signal, deps, onProgress } = options;

  let agentId = "";
  let agentName = "";
  let artifacts = emptyArtifacts();
  let usage: AiChatMessageUsage | null = null;
  let reporter: ProgressReporter | null = null;

  try {
    assertSubagentDepth(depth);

    const args = parseRunSubagentArgs(call);
    agentId = args.agentId;

    const agent = deps.resolveAgentConfig(args.agentId);
    if (!agent || agent.id !== args.agentId) {
      return toToolExecution(
        call,
        failedSubagentResult({
          agentId: args.agentId,
          agentName: args.agentId,
          error: `Agent「${args.agentId}」不存在。`,
        }),
      );
    }
    agentName = agent.name;
    reporter = createProgressReporter({
      agentId: agent.id,
      agentName: agent.name,
      onProgress,
    });
    reporter.emit("starting");

    const childToolNames = stripSubagentTools(agent.availableToolNames);
    const tools: ToolDefinition[] = selectAiTools(childToolNames);
    if (tools.length === 0) {
      return toToolExecution(
        call,
        failedSubagentResult({
          agentId: agent.id,
          agentName: agent.name,
          error: `Agent「${agent.name}」没有可用于子运行的工具。`,
        }),
      );
    }

    const modelId = resolveSubagentModelId(
      agent.defaultModelId,
      deps.parentSelectedModelId,
      (id) => id === MOCK_AI_MODEL_ID || deps.resolveModelConfig(id) !== null,
    );

    const backend = resolveBackend(deps, agent, modelId);
    const toolRunner = deps.toolRunner ?? createToolRunner(deps.resolveWorktree);
    let focusSnapshots: ReturnType<typeof resolveFocusSnapshots> = [];
    if (args.focus.length > 0) {
      try {
        focusSnapshots = resolveFocusSnapshots(deps.resolveWorktree(), args.focus);
      } catch {
        // Soft-fallback: child still receives bare focus ids via buildSubagentUserMessage.
        focusSnapshots = [];
      }
    }
    const userMessage = buildSubagentUserMessage(args, agent.name, focusSnapshots);

    let input: InputItem[] = [toInputItem(userMessage)];
    let toolRoundCount = 0;
    let lastSummary = "";

    while (true) {
      if (signal.aborted) {
        return toToolExecution(
          call,
          abortedSubagentResult({
            agentId: agent.id,
            agentName: agent.name,
            artifacts,
            usage,
          }),
        );
      }

      reporter.bumpRound();
      reporter.emit("thinking", { currentTool: null });

      const response = await consumeStreamWithProgress(
        backend.client.stream({
          instructions: backend.instructions,
          input,
          tools,
          signal,
          ...(backend.maxOutputTokens !== undefined
            ? { maxOutputTokens: backend.maxOutputTokens }
            : {}),
          ...(deps.parentSelectedReasoningLevel != null
            ? { reasoningLevel: deps.parentSelectedReasoningLevel }
            : {}),
        }),
        signal,
        (fullText) => {
          reporter?.setPartialSummary(fullText);
        },
      );
      reporter.forceFlush();

      usage = addMessageUsage(usage, response.usage);
      const responseText = readResponseText(response).trim();
      if (responseText !== "") {
        lastSummary = responseText;
        reporter.setPartialSummary(responseText);
        reporter.forceFlush();
      }

      if (response.toolCalls.length === 0) {
        break;
      }

      toolRoundCount += 1;
      if (toolRoundCount > MAX_SUBAGENT_TOOL_ROUNDS) {
        reporter.emit("finalizing");
        return toToolExecution(
          call,
          failedSubagentResult({
            agentId: agent.id,
            agentName: agent.name,
            error: `子代理工具循环超过 ${MAX_SUBAGENT_TOOL_ROUNDS} 轮。`,
            summary: lastSummary,
            artifacts,
            usage,
          }),
        );
      }

      input = [...input, ...response.replay];

      for (const toolCall of response.toolCalls) {
        if (signal.aborted) {
          return toToolExecution(
            call,
            abortedSubagentResult({
              agentId: agent.id,
              agentName: agent.name,
              artifacts,
              usage,
            }),
          );
        }

        if (
          toolCall.name === RUN_SUBAGENT_TOOL_NAME ||
          toolCall.name === "ask_user" ||
          !childToolNames.includes(toolCall.name)
        ) {
          reporter.emit("finalizing");
          return toToolExecution(
            call,
            failedSubagentResult({
              agentId: agent.id,
              agentName: agent.name,
              error: `子代理尝试调用不允许的工具「${toolCall.name}」。`,
              summary: lastSummary,
              artifacts,
              usage,
            }),
          );
        }

        reporter.emit("tool", {
          currentTool: { name: toolCall.name, status: "running" },
        });

        const execution = await toolRunner.execute(toolCall);
        if (execution.userInputRequest) {
          reporter.pushRecentTool({ name: toolCall.name, status: "error" });
          reporter.setArtifacts(artifacts);
          reporter.emit("finalizing");
          return toToolExecution(
            call,
            failedSubagentResult({
              agentId: agent.id,
              agentName: agent.name,
              error: "子代理不支持 ask_user；请由编排者先向用户澄清后再委派。",
              summary: lastSummary,
              artifacts,
              usage,
            }),
          );
        }

        const toolStatus = execution.errorMessage === null ? "complete" : "error";
        artifacts = collectArtifactsFromToolCall(toolCall, execution.resultText, artifacts);
        reporter.setArtifacts(artifacts);
        reporter.pushRecentTool({ name: toolCall.name, status: toolStatus });
        reporter.emit("tool", { currentTool: null });

        input.push(execution.toolResult);
      }
    }

    reporter.emit("finalizing");

    if (lastSummary.trim() === "") {
      return toToolExecution(
        call,
        failedSubagentResult({
          agentId: agent.id,
          agentName: agent.name,
          error: "子代理未返回可用摘要。",
          artifacts,
          usage,
        }),
      );
    }

    return toToolExecution(
      call,
      completedSubagentResult({
        agentId: agent.id,
        agentName: agent.name,
        summary: lastSummary,
        artifacts,
        usage,
      }),
    );
  } catch (error) {
    if (isAbortError(error) || signal.aborted) {
      return toToolExecution(
        call,
        abortedSubagentResult({
          agentId: agentId || "unknown",
          agentName: agentName || agentId || "unknown",
          artifacts,
          usage,
        }),
      );
    }

    return toToolExecution(
      call,
      failedSubagentResult({
        agentId: agentId || "unknown",
        agentName: agentName || agentId || "unknown",
        error: toErrorMessage(error),
        artifacts,
        usage,
      }),
    );
  } finally {
    reporter?.cancel();
  }
}
