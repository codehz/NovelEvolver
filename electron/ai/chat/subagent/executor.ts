import type {
  AIResponse,
  AIStreamEvent,
  InputItem,
  ToolCallItem,
  ToolDefinition,
} from "@codehz/ai";
import { collectStream } from "@codehz/ai";

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
import { appendToolCallRecoveryInstruction, findRecoverableToolCallError } from "../../tools/parse";
import {
  projectToolOutcome,
  projectToolSubject,
  projectToolSubjectFromResult,
} from "../../tools/project-subject";
import { okJson } from "../../tools/result";
import { buildSubagentUserMessage, parseRunSubagentArgs } from "./context";
import { resolveFocusSnapshots } from "./focus-inject";
import {
  captureSubagentOutputTarget,
  type CapturedSubagentOutputTarget,
  writeSubagentOutput,
} from "./output-write";
import {
  assertSubagentDepth,
  assertSubagentEligible,
  MAX_FOCUS_CONTENT_CHARS,
  MAX_FOCUS_TARGETS,
  MAX_PARENT_SUMMARY_CHARS,
  MAX_SUBAGENT_TOOL_ROUNDS,
  resolveSubagentModelId,
  RUN_SUBAGENT_TOOL_NAME,
  resolveSubagentEffectiveToolNames,
} from "./policy";
import {
  abortedSubagentResult,
  collectArtifactsFromToolCall,
  completedSubagentResult,
  failedSubagentResult,
  type SubagentArtifacts,
  type SubagentOutput,
  type SubagentRunResult,
} from "./result";
import {
  buildStepsDigest,
  createSubagentViewReporter,
  type SubagentViewReporter,
} from "./view-reporter";

/** Budgets for one nested subagent run (defaults keep unit tests lean). */
export type SubagentRuntimePolicy = {
  maxSubagentToolRounds: number;
  maxParentSummaryChars: number;
  maxFocusTargets: number;
  maxFocusContentChars: number;
};

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
  /**
   * Runtime budgets for this run. Omitted fields fall back to historical defaults
   * so tests need not construct a full policy.
   */
  policy?: Partial<SubagentRuntimePolicy>;
};

function resolveSubagentPolicy(partial?: Partial<SubagentRuntimePolicy>): SubagentRuntimePolicy {
  return {
    maxSubagentToolRounds:
      typeof partial?.maxSubagentToolRounds === "number" &&
      Number.isFinite(partial.maxSubagentToolRounds) &&
      partial.maxSubagentToolRounds > 0
        ? Math.floor(partial.maxSubagentToolRounds)
        : MAX_SUBAGENT_TOOL_ROUNDS,
    maxParentSummaryChars:
      typeof partial?.maxParentSummaryChars === "number" &&
      Number.isFinite(partial.maxParentSummaryChars) &&
      partial.maxParentSummaryChars > 0
        ? Math.floor(partial.maxParentSummaryChars)
        : MAX_PARENT_SUMMARY_CHARS,
    maxFocusTargets:
      typeof partial?.maxFocusTargets === "number" &&
      Number.isFinite(partial.maxFocusTargets) &&
      partial.maxFocusTargets > 0
        ? Math.floor(partial.maxFocusTargets)
        : MAX_FOCUS_TARGETS,
    maxFocusContentChars:
      typeof partial?.maxFocusContentChars === "number" &&
      Number.isFinite(partial.maxFocusContentChars) &&
      partial.maxFocusContentChars > 0
        ? Math.floor(partial.maxFocusContentChars)
        : MAX_FOCUS_CONTENT_CHARS,
  };
}

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
  let partialText = "";

  async function* observeProgress(): AsyncGenerator<AIStreamEvent> {
    for await (const event of stream) {
      if (signal.aborted) {
        throw new DOMException("AI generation stopped by user.", "AbortError");
      }

      if (event.type === "message.delta") {
        const chunk = contentBlockToDisplayText(event.delta);
        if (chunk !== "") {
          partialText += chunk;
          onMessageDelta(partialText);
        }
      }
      yield event;
    }
  }

  return collectStream(observeProgress());
}

function pushUniqueNodeId(ids: string[], id: string): string[] {
  if (id === "" || ids.includes(id)) {
    return ids;
  }
  return [...ids, id];
}

function toSubagentOutput(writeResult: ReturnType<typeof writeSubagentOutput>): SubagentOutput {
  return {
    written: writeResult.written,
    error: writeResult.error,
    target: writeResult.target,
    stats: writeResult.stats,
    previous_stats: writeResult.previous_stats,
    delta: writeResult.delta,
    revision: writeResult.revision,
  };
}

function finalizeOutputTargetResult(input: {
  agentId: string;
  agentName: string;
  lastReport: string;
  artifacts: SubagentArtifacts;
  usage: AiChatMessageUsage | null;
  stepsDigest: string;
  capturedOutput: CapturedSubagentOutputTarget;
  worktree: ReturnType<ResolveWorktree>;
}): SubagentRunResult {
  const trimmedReport = input.lastReport.trim();
  if (trimmedReport === "") {
    return failedSubagentResult({
      agentId: input.agentId,
      agentName: input.agentName,
      error: "子代理未产出正文，无法写入 output_target。",
      stepsDigest: input.stepsDigest,
      artifacts: input.artifacts,
      usage: input.usage,
      output: toSubagentOutput({
        written: false,
        error: "子代理未产出正文。",
        target: {
          domain: input.capturedOutput.domain,
          id: input.capturedOutput.id,
          kind: input.capturedOutput.kind,
          label: input.capturedOutput.label,
          display_path: input.capturedOutput.displayPath,
        },
        stats: null,
        previous_stats: null,
        delta: null,
        revision: null,
      }),
    });
  }

  const writeResult = writeSubagentOutput(input.worktree, input.capturedOutput, trimmedReport);
  const output = toSubagentOutput(writeResult);
  let artifacts = input.artifacts;

  if (writeResult.written) {
    artifacts = {
      wrote: true,
      touched_node_ids: pushUniqueNodeId(artifacts.touched_node_ids, input.capturedOutput.id),
    };
    return completedSubagentResult({
      agentId: input.agentId,
      agentName: input.agentName,
      report: "",
      stepsDigest: input.stepsDigest,
      artifacts,
      output,
      usage: input.usage,
    });
  }

  return completedSubagentResult({
    agentId: input.agentId,
    agentName: input.agentName,
    report: trimmedReport,
    stepsDigest: input.stepsDigest,
    artifacts,
    output,
    usage: input.usage,
  });
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

function finished(execution: ToolExecutionResult): SubagentGenerationPhaseResult {
  return { kind: "finished", execution };
}

export type SubagentPendingWriteState = {
  call: ToolCallItem;
  agentId: string;
  agentName: string;
  lastReport: string;
  artifacts: SubagentArtifacts;
  usage: AiChatMessageUsage | null;
  stepsDigest: string;
  capturedOutput: CapturedSubagentOutputTarget;
  reporter: SubagentViewReporter;
};

export type SubagentGenerationPhaseResult =
  | { kind: "finished"; execution: ToolExecutionResult }
  | { kind: "pending_write"; state: SubagentPendingWriteState };

/** Build a failed tool result when a parallel batch fails validation before any LLM run. */
export function subagentBatchConflictExecution(
  call: ToolCallItem,
  message: string,
): ToolExecutionResult {
  let agentId = "unknown";
  let agentName = "unknown";
  try {
    const args = parseRunSubagentArgs(call);
    agentId = args.agentId;
    agentName = args.agentId;
  } catch {
    // Keep generic ids when args are invalid.
  }
  return toToolExecution(
    call,
    failedSubagentResult({
      agentId,
      agentName,
      error: message,
    }),
  );
}

/** Serial output_target write after a deferred parallel generation phase. */
export function finalizeSubagentPendingWrite(
  state: SubagentPendingWriteState,
  worktree: ReturnType<ResolveWorktree>,
): ToolExecutionResult {
  try {
    const outputResult = finalizeOutputTargetResult({
      agentId: state.agentId,
      agentName: state.agentName,
      lastReport: state.lastReport,
      artifacts: state.artifacts,
      usage: state.usage,
      stepsDigest: state.stepsDigest,
      capturedOutput: state.capturedOutput,
      worktree,
    });
    if (outputResult.artifacts.wrote) {
      state.reporter.setArtifacts(outputResult.artifacts);
    }
    return finishWith(state.call, outputResult, state.reporter);
  } finally {
    state.reporter.cancel();
  }
}

type RunSubagentCoreOptions = {
  call: ToolCallItem;
  depth: number;
  signal: AbortSignal;
  deps: SubagentExecutorDeps;
  deferOutputWrite: boolean;
  onView?: (view: AiSubagentToolView) => void;
  onProgress?: (progress: { phase: string; current_tool?: { name: string } | null }) => void;
};

async function runSubagentCore(
  options: RunSubagentCoreOptions,
): Promise<SubagentGenerationPhaseResult> {
  const { call, depth, signal, deps, deferOutputWrite } = options;
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
  let holdReporter = false;
  const policy = resolveSubagentPolicy(deps.policy);

  try {
    assertSubagentDepth(depth);

    const args = parseRunSubagentArgs(call, {
      maxParentSummaryChars: policy.maxParentSummaryChars,
    });
    agentId = args.agentId;

    const agent = deps.resolveAgentConfig(args.agentId);
    if (!agent || agent.id !== args.agentId) {
      return finished(
        toToolExecution(
          call,
          failedSubagentResult({
            agentId: args.agentId,
            agentName: args.agentId,
            error: `Agent「${args.agentId}」不存在。`,
          }),
        ),
      );
    }
    agentName = agent.name;

    try {
      assertSubagentEligible(agent);
    } catch (error) {
      return finished(
        toToolExecution(
          call,
          failedSubagentResult({
            agentId: agent.id,
            agentName: agent.name,
            error: toErrorMessage(error),
          }),
        ),
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
      maxRounds: policy.maxSubagentToolRounds,
      onView,
    });
    reporter.emit("starting");

    let capturedOutput: CapturedSubagentOutputTarget | null = null;
    if (args.outputTarget) {
      try {
        capturedOutput = captureSubagentOutputTarget(deps.resolveWorktree(), args.outputTarget);
      } catch (error) {
        return finished(
          finishWith(
            call,
            failedSubagentResult({
              agentId: agent.id,
              agentName: agent.name,
              error: toErrorMessage(error),
            }),
            reporter,
          ),
        );
      }
    }

    const childToolNames = resolveSubagentEffectiveToolNames(agent);
    const tools: ToolDefinition[] = selectAiTools(childToolNames);

    const modelId = resolveSubagentModelId(
      agent.defaultModelId,
      deps.parentSelectedModelId,
      (id) => id === MOCK_AI_MODEL_ID || deps.resolveModelConfig(id) !== null,
    );

    if (tools.length > 0) {
      const modelConfig = deps.resolveModelConfig(modelId);
      const supportsTools =
        modelId === MOCK_AI_MODEL_ID || (modelConfig?.supportsTools ?? true) !== false;
      if (!supportsTools) {
        const modelLabel = modelConfig?.name?.trim() || modelId;
        return finished(
          finishWith(
            call,
            failedSubagentResult({
              agentId: agent.id,
              agentName: agent.name,
              error: `模型「${modelLabel}」不支持工具调用，无法运行需要工具的子代理「${agent.name}」。`,
            }),
            reporter,
          ),
        );
      }
    }

    const backend = resolveBackend(deps, agent, modelId);
    const toolRunner = deps.toolRunner ?? createToolRunner(deps.resolveWorktree);
    let focusSnapshots: ReturnType<typeof resolveFocusSnapshots> = [];
    if (args.focus.length > 0) {
      try {
        focusSnapshots = resolveFocusSnapshots(deps.resolveWorktree(), args.focus, {
          maxFocusTargets: policy.maxFocusTargets,
          maxFocusContentChars: policy.maxFocusContentChars,
        });
      } catch {
        focusSnapshots = [];
      }
    }
    const userMessage = buildSubagentUserMessage(args, agent.name, focusSnapshots, {
      maxFocusContentChars: policy.maxFocusContentChars,
      outputTarget: capturedOutput
        ? {
            domain: capturedOutput.domain,
            id: capturedOutput.id,
            label: capturedOutput.label,
            displayPath: capturedOutput.displayPath,
          }
        : null,
    });

    let input: InputItem[] = [toInputItem(userMessage)];
    let toolRoundCount = 0;
    let lastReport = "";
    let recoveryInstruction: { toolName: string; message: string } | null = null;

    while (true) {
      if (signal.aborted) {
        return finished(
          finishWith(
            call,
            abortedSubagentResult({
              agentId: agent.id,
              agentName: agent.name,
              artifacts,
              usage,
              stepsDigest: buildStepsDigest(reporter.snapshot().steps),
            }),
            reporter,
          ),
        );
      }

      const reportBeforeRound = lastReport;

      reporter.bumpRound();
      reporter.emit("thinking");

      const instructions = recoveryInstruction
        ? appendToolCallRecoveryInstruction(
            backend.instructions,
            recoveryInstruction.toolName,
            recoveryInstruction.message,
          )
        : backend.instructions;
      recoveryInstruction = null;
      const response = await consumeStreamWithProgress(
        backend.client.stream({
          instructions,
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
      if (toolRoundCount > policy.maxSubagentToolRounds) {
        reporter.emit("finalizing");
        return finished(
          finishWith(
            call,
            failedSubagentResult({
              agentId: agent.id,
              agentName: agent.name,
              error: `子代理工具循环超过 ${policy.maxSubagentToolRounds} 轮。`,
              report: lastReport,
              artifacts,
              usage,
              stepsDigest: buildStepsDigest(reporter.snapshot().steps),
            }),
            reporter,
          ),
        );
      }

      const recoverable = findRecoverableToolCallError(response.toolCalls);
      if (recoverable) {
        recoveryInstruction = {
          toolName: recoverable.call.name,
          message: recoverable.error.message,
        };
        lastReport = reportBeforeRound;
        reporter.setReport(lastReport);
        reporter.forceFlush();
        continue;
      }

      input = [...input, ...response.replay];

      for (const toolCall of response.toolCalls) {
        if (signal.aborted) {
          return finished(
            finishWith(
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
            ),
          );
        }

        if (
          toolCall.name === RUN_SUBAGENT_TOOL_NAME ||
          toolCall.name === "ask_user" ||
          !childToolNames.includes(toolCall.name)
        ) {
          reporter.emit("finalizing");
          return finished(
            finishWith(
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
            ),
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
          return finished(
            finishWith(
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
            ),
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

    const stepsDigest = buildStepsDigest(reporter.snapshot().steps);

    if (capturedOutput) {
      if (deferOutputWrite) {
        holdReporter = true;
        return {
          kind: "pending_write",
          state: {
            call,
            agentId: agent.id,
            agentName: agent.name,
            lastReport,
            artifacts,
            usage,
            stepsDigest,
            capturedOutput,
            reporter,
          },
        };
      }

      const outputResult = finalizeOutputTargetResult({
        agentId: agent.id,
        agentName: agent.name,
        lastReport,
        artifacts,
        usage,
        stepsDigest,
        capturedOutput,
        worktree: deps.resolveWorktree(),
      });
      if (outputResult.artifacts.wrote) {
        reporter.setArtifacts(outputResult.artifacts);
      }
      return finished(finishWith(call, outputResult, reporter));
    }

    return finished(
      finishWith(
        call,
        completedSubagentResult({
          agentId: agent.id,
          agentName: agent.name,
          report: lastReport,
          artifacts,
          usage,
          stepsDigest,
        }),
        reporter,
      ),
    );
  } catch (error) {
    if (isAbortError(error) || signal.aborted) {
      return finished(
        finishWith(
          call,
          abortedSubagentResult({
            agentId: agentId || "unknown",
            agentName: agentName || agentId || "unknown",
            artifacts,
            usage,
            stepsDigest: reporter ? buildStepsDigest(reporter.snapshot().steps) : "",
          }),
          reporter,
        ),
      );
    }

    return finished(
      finishWith(
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
      ),
    );
  } finally {
    if (!holdReporter) {
      reporter?.cancel();
    }
  }
}

/**
 * Run the generation phase only (LLM + tools). When `output_target` is set the write is deferred
 * so parallel batches can serialize output_target commits in call order.
 */
export async function executeSubagentGenerationPhase(options: {
  call: ToolCallItem;
  depth: number;
  signal: AbortSignal;
  deps: SubagentExecutorDeps;
  onView?: (view: AiSubagentToolView) => void;
  onProgress?: (progress: { phase: string; current_tool?: { name: string } | null }) => void;
}): Promise<SubagentGenerationPhaseResult> {
  return runSubagentCore({ ...options, deferOutputWrite: true });
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
  const result = await runSubagentCore({ ...options, deferOutputWrite: false });
  if (result.kind === "finished") {
    return result.execution;
  }
  return finalizeSubagentPendingWrite(result.state, options.deps.resolveWorktree());
}
