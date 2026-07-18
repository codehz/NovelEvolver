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
import { addMessageUsage, readResponseText, toErrorMessage } from "../../ai-utils";
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
import {
  assertSubagentDepth,
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

async function consumeStream(
  stream: AsyncIterable<AIStreamEvent>,
  signal: AbortSignal,
): Promise<AIResponse> {
  const events: AIStreamEvent[] = [];
  for await (const event of stream) {
    if (signal.aborted) {
      throw new DOMException("AI generation stopped by user.", "AbortError");
    }
    events.push(event);
  }
  return aggregateEvents(events);
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

/**
 * Run an isolated specialist agent for a single `run_subagent` tool call.
 * Does not emit parent conversation UI events for intermediate child turns.
 */
export async function executeSubagentToolCall(options: {
  call: ToolCallItem;
  depth: number;
  signal: AbortSignal;
  deps: SubagentExecutorDeps;
}): Promise<ToolExecutionResult> {
  const { call, depth, signal, deps } = options;

  let agentId = "";
  let agentName = "";
  let artifacts = emptyArtifacts();
  let usage: AiChatMessageUsage | null = null;

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
    const userMessage = buildSubagentUserMessage(args, agent.name);

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

      const response = await consumeStream(
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
      );

      usage = addMessageUsage(usage, response.usage);
      const responseText = readResponseText(response).trim();
      if (responseText !== "") {
        lastSummary = responseText;
      }

      if (response.toolCalls.length === 0) {
        break;
      }

      toolRoundCount += 1;
      if (toolRoundCount > MAX_SUBAGENT_TOOL_ROUNDS) {
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

        const execution = await toolRunner.execute(toolCall);
        if (execution.userInputRequest) {
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

        artifacts = collectArtifactsFromToolCall(toolCall, execution.resultText, artifacts);
        input.push(execution.toolResult);
      }
    }

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
  }
}
