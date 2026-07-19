import type {
  AIResponse,
  AIStreamEvent,
  InputItem,
  ToolCallItem,
  ToolDefinition,
} from "@codehz/ai";
import { aggregateEvents } from "@codehz/ai";

import type {
  AiChatMessageUsage,
  AiChatSelectableModelKind,
  AiSubagentToolView,
  AiToolViewFocus,
} from "#shared/rpc/ai/index";
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
import type { MockScenarioPacing } from "../../mock/scenario-types";
import {
  createToolRunner,
  selectAiTools,
  type ResolveWorktree,
  type ToolExecutionResult,
  type ToolRunner,
} from "../../tools";
import {
  projectToolOutcome,
  projectToolSubject,
  projectToolSubjectFromResult,
} from "../../tools/project-subject";
import { okJson } from "../../tools/result";
import { buildSubagentUserMessage, parseRunSubagentArgs } from "./context";
import { resolveFocusSnapshots } from "./focus-inject";
import {
  assertSubagentDepth,
  assertSubagentEligible,
  MAX_SUBAGENT_TOOL_ROUNDS,
  resolveSubagentModelId,
  RUN_SUBAGENT_TOOL_NAME,
  stripSubagentTools,
} from "./policy";
import {
  abortedSubagentResult,
  collectArtifactsFromToolCall,
  completedSubagentResult,
  failedSubagentResult,
  type SubagentArtifacts,
  type SubagentRunResult,
} from "./result";
import {
  buildStepsDigest,
  createSubagentViewReporter,
  type SubagentViewReporter,
} from "./view-reporter";

export type SubagentExecutorDeps = {
  resolveAgentConfig: (agentId: string) => AiAgentRuntimeConfig | null;
  resolveModelConfig: (modelId: string) => AiModelRuntimeConfig | null;
  resolveWorktree: ResolveWorktree;
  clientLabel: string;
  parentSelectedModelId: string;
  parentSelectedReasoningLevel: AiReasoningLevel | null;
  parentAdapterKind: AiChatSelectableModelKind;
  /**
   * When the parent conversation is a mock AI scenario, pass the same scenario id
   * so nested child streams can match parent/child turns via `isSubagentRequest`.
   */
  scenarioId?: string | null;
  /** Pacing for nested scenario clients (defaults to preview in createAiBackendSession). */
  scenarioPacing?: MockScenarioPacing;
  /** Optional override for tests / scenario simulated tool results. */
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

function toToolExecution(
  call: ToolCallItem,
  result: SubagentRunResult,
  view: AiSubagentToolView | null = null,
): ToolExecutionResult {
  return okJson(call, result, view);
}

function resolveBackend(
  deps: SubagentExecutorDeps,
  agent: AiAgentRuntimeConfig,
  modelId: string,
): AiBackendSession {
  if (deps.createBackend) {
    return deps.createBackend({ agent, modelId });
  }

  const childLabel = `${deps.clientLabel}/subagent/${agent.id}`;

  if (deps.scenarioId) {
    return createAiBackendSession({
      clientLabel: childLabel,
      scenarioId: deps.scenarioId,
      pacing: deps.scenarioPacing,
      instructionsOverride: agent.systemPrompt,
    });
  }

  if (modelId === "" || modelId === MOCK_AI_MODEL_ID || deps.parentAdapterKind === "mock") {
    return createAiBackendSession({
      clientLabel: childLabel,
      instructionsOverride: agent.systemPrompt,
    });
  }

  const modelConfig = deps.resolveModelConfig(modelId);
  if (!modelConfig) {
    throw new Error(`子代理模型「${modelId}」不可用。`);
  }

  return createAiBackendSession({
    clientLabel: childLabel,
    modelConfig,
    instructionsOverride: agent.systemPrompt,
  });
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

function finishWith(
  call: ToolCallItem,
  result: SubagentRunResult,
  reporter: SubagentViewReporter | null,
): ToolExecutionResult {
  const view = reporter?.finalize(result.status) ?? null;
  if (view && result.steps_digest === "") {
    // Ensure model digest is present when steps exist but builder left it empty.
  }
  const withDigest =
    result.steps_digest === "" && view
      ? { ...result, steps_digest: buildStepsDigest(view.steps) }
      : result;
  return toToolExecution(
    call,
    withDigest,
    view ? { ...view, report: withDigest.report || view.report } : null,
  );
}

/**
 * Run an isolated specialist agent for a single `run_subagent` tool call.
 * Intermediate UI progress is delivered only via `onView` (not parent history parts).
 */
export async function executeSubagentToolCall(options: {
  call: ToolCallItem;
  depth: number;
  signal: AbortSignal;
  deps: SubagentExecutorDeps;
  /** Optional UI view sink (live + terminal). */
  onView?: (view: AiSubagentToolView) => void;
  /**
   * @deprecated Use `onView`. Kept temporarily for tests that listen to phase names
   * via the old progress shape — maps through view.phase.
   */
  onProgress?: (progress: { phase: string; current_tool?: { name: string } | null }) => void;
}): Promise<ToolExecutionResult> {
  const { call, depth, signal, deps } = options;
  const onView = (view: AiSubagentToolView) => {
    options.onView?.(view);
    options.onProgress?.({
      phase: view.phase === "done" ? "finalizing" : view.phase,
      current_tool:
        [...view.steps].reverse().find((step) => step.status === "running") != null
          ? {
              name: [...view.steps].reverse().find((step) => step.status === "running")!.name,
            }
          : null,
    });
  };

  let agentId = "";
  let agentName = "";
  let artifacts = emptyArtifacts();
  let usage: AiChatMessageUsage | null = null;
  let reporter: SubagentViewReporter | null = null;

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

    try {
      assertSubagentEligible(agent);
    } catch (error) {
      return toToolExecution(
        call,
        failedSubagentResult({
          agentId: agent.id,
          agentName: agent.name,
          error: toErrorMessage(error),
        }),
      );
    }

    const focus: AiToolViewFocus[] = args.focus.map((entry) => ({
      domain: entry.domain,
      id: entry.id,
    }));

    reporter = createSubagentViewReporter({
      agentId: agent.id,
      agentName: agent.name,
      task: args.task,
      constraints: args.constraints,
      focus,
      onView,
    });
    reporter.emit("starting");

    const childToolNames = stripSubagentTools(agent.availableToolNames);
    const tools: ToolDefinition[] = selectAiTools(childToolNames);
    if (tools.length === 0) {
      return finishWith(
        call,
        failedSubagentResult({
          agentId: agent.id,
          agentName: agent.name,
          error: `Agent「${agent.name}」没有可用于子运行的工具。`,
        }),
        reporter,
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
        focusSnapshots = [];
      }
    }
    const userMessage = buildSubagentUserMessage(args, agent.name, focusSnapshots);

    let input: InputItem[] = [toInputItem(userMessage)];
    let toolRoundCount = 0;
    let lastReport = "";

    while (true) {
      if (signal.aborted) {
        return finishWith(
          call,
          abortedSubagentResult({
            agentId: agent.id,
            agentName: agent.name,
            artifacts,
            usage,
            stepsDigest: buildStepsDigest(reporter.snapshot().steps),
          }),
          reporter,
        );
      }

      reporter.bumpRound();
      reporter.emit("thinking");

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
          reporter?.setReport(fullText);
        },
      );
      reporter.forceFlush();

      usage = addMessageUsage(usage, response.usage);
      const responseText = readResponseText(response).trim();
      if (responseText !== "") {
        lastReport = responseText;
        reporter.setReport(responseText);
        reporter.forceFlush();
      }

      if (response.toolCalls.length === 0) {
        break;
      }

      toolRoundCount += 1;
      if (toolRoundCount > MAX_SUBAGENT_TOOL_ROUNDS) {
        reporter.emit("finalizing");
        return finishWith(
          call,
          failedSubagentResult({
            agentId: agent.id,
            agentName: agent.name,
            error: `子代理工具循环超过 ${MAX_SUBAGENT_TOOL_ROUNDS} 轮。`,
            report: lastReport,
            artifacts,
            usage,
            stepsDigest: buildStepsDigest(reporter.snapshot().steps),
          }),
          reporter,
        );
      }

      input = [...input, ...response.replay];

      for (const toolCall of response.toolCalls) {
        if (signal.aborted) {
          return finishWith(
            call,
            abortedSubagentResult({
              agentId: agent.id,
              agentName: agent.name,
              artifacts,
              usage,
              report: lastReport,
              stepsDigest: buildStepsDigest(reporter.snapshot().steps),
            }),
            reporter,
          );
        }

        if (
          toolCall.name === RUN_SUBAGENT_TOOL_NAME ||
          toolCall.name === "ask_user" ||
          !childToolNames.includes(toolCall.name)
        ) {
          reporter.emit("finalizing");
          return finishWith(
            call,
            failedSubagentResult({
              agentId: agent.id,
              agentName: agent.name,
              error: `子代理尝试调用不允许的工具「${toolCall.name}」。`,
              report: lastReport,
              artifacts,
              usage,
              stepsDigest: buildStepsDigest(reporter.snapshot().steps),
            }),
            reporter,
          );
        }

        const subject = projectToolSubject(toolCall.name, toolCall.argumentsText);
        const stepId = reporter.beginStep({ name: toolCall.name, subject });

        const execution = await toolRunner.execute(toolCall);
        if (execution.userInputRequest) {
          reporter.completeStep({
            id: stepId,
            status: "error",
            outcome: "不支持",
            errorMessage: "子代理不支持 ask_user",
          });
          reporter.setArtifacts(artifacts);
          reporter.emit("finalizing");
          return finishWith(
            call,
            failedSubagentResult({
              agentId: agent.id,
              agentName: agent.name,
              error: "子代理不支持 ask_user；请由编排者先向用户澄清后再委派。",
              report: lastReport,
              artifacts,
              usage,
              stepsDigest: buildStepsDigest(reporter.snapshot().steps),
            }),
            reporter,
          );
        }

        const toolStatus = execution.errorMessage === null ? "complete" : "error";
        artifacts = collectArtifactsFromToolCall(toolCall, execution.resultText, artifacts);
        reporter.setArtifacts(artifacts);
        reporter.completeStep({
          id: stepId,
          status: toolStatus,
          subject: projectToolSubjectFromResult(
            toolCall.name,
            toolCall.argumentsText,
            execution.resultText,
          ),
          outcome: projectToolOutcome(toolCall.name, execution.resultText, execution.errorMessage),
          errorMessage: execution.errorMessage,
        });

        input.push(execution.toolResult);
      }
    }

    reporter.emit("finalizing");

    // Timeline-first: empty report is allowed when work completed without prose.
    return finishWith(
      call,
      completedSubagentResult({
        agentId: agent.id,
        agentName: agent.name,
        report: lastReport,
        artifacts,
        usage,
        stepsDigest: buildStepsDigest(reporter.snapshot().steps),
      }),
      reporter,
    );
  } catch (error) {
    if (isAbortError(error) || signal.aborted) {
      return finishWith(
        call,
        abortedSubagentResult({
          agentId: agentId || "unknown",
          agentName: agentName || agentId || "unknown",
          artifacts,
          usage,
          stepsDigest: reporter ? buildStepsDigest(reporter.snapshot().steps) : "",
        }),
        reporter,
      );
    }

    return finishWith(
      call,
      failedSubagentResult({
        agentId: agentId || "unknown",
        agentName: agentName || agentId || "unknown",
        error: toErrorMessage(error),
        artifacts,
        usage,
        stepsDigest: reporter ? buildStepsDigest(reporter.snapshot().steps) : "",
      }),
      reporter,
    );
  } finally {
    reporter?.cancel();
  }
}
