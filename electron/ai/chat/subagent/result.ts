import type { ToolCallItem } from "@codehz/ai";

import type { AiChatMessageUsage } from "#shared/rpc/ai/index";

export type SubagentRunStatus = "completed" | "failed" | "needs_user" | "aborted";

export type SubagentArtifacts = {
  touched_node_ids: string[];
  wrote: boolean;
};

export type SubagentRunResult = {
  status: SubagentRunStatus;
  agent_id: string;
  agent_name: string;
  /** Optional prose report for the parent model; may be empty. */
  report: string;
  /** Compressed timeline digest for the parent model (not a UI field). */
  steps_digest: string;
  artifacts: SubagentArtifacts;
  usage: AiChatMessageUsage | null;
  error: string | null;
};

const WRITE_TOOL_NAMES = new Set([
  "write_document",
  "replace_document_text",
  "create_document",
  "create_folder",
  "move_node",
  "rename_node",
  "delete_node",
]);

function emptyArtifacts(): SubagentArtifacts {
  return { touched_node_ids: [], wrote: false };
}

function pushUnique(ids: string[], id: string): void {
  if (id !== "" && !ids.includes(id)) {
    ids.push(id);
  }
}

function tryParseJsonObject(text: string | null | undefined): Record<string, unknown> | null {
  if (typeof text !== "string" || text.trim() === "") {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore
  }
  return null;
}

function readIdField(record: Record<string, unknown> | null, key: string): string | null {
  if (!record) {
    return null;
  }
  const value = record[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function collectIdsFromObject(record: Record<string, unknown> | null, out: string[]): void {
  if (!record) {
    return;
  }
  const direct = readIdField(record, "id");
  if (direct) {
    pushUnique(out, direct);
  }
  const target = record.target;
  if (typeof target === "object" && target !== null && !Array.isArray(target)) {
    const targetId = readIdField(target as Record<string, unknown>, "id");
    if (targetId) {
      pushUnique(out, targetId);
    }
  }
  const nodeId = readIdField(record, "node_id");
  if (nodeId) {
    pushUnique(out, nodeId);
  }
}

/**
 * Coarsely collect node ids / write flags from a completed child tool call.
 * Best-effort: failures to parse do not throw.
 */
export function collectArtifactsFromToolCall(
  call: Pick<ToolCallItem, "name" | "argumentsText">,
  resultText: string | null,
  previous: SubagentArtifacts = emptyArtifacts(),
): SubagentArtifacts {
  const touched = [...previous.touched_node_ids];
  let wrote = previous.wrote;

  if (WRITE_TOOL_NAMES.has(call.name)) {
    wrote = true;
    collectIdsFromObject(tryParseJsonObject(call.argumentsText), touched);
    collectIdsFromObject(tryParseJsonObject(resultText), touched);
  }

  return { touched_node_ids: touched, wrote };
}

export function buildSubagentResult(input: {
  status: SubagentRunStatus;
  agentId: string;
  agentName: string;
  report?: string;
  stepsDigest?: string;
  artifacts?: SubagentArtifacts;
  usage?: AiChatMessageUsage | null;
  error?: string | null;
}): SubagentRunResult {
  return {
    status: input.status,
    agent_id: input.agentId,
    agent_name: input.agentName,
    report: (input.report ?? "").trim(),
    steps_digest: (input.stepsDigest ?? "").trim(),
    artifacts: input.artifacts ?? emptyArtifacts(),
    usage: input.usage ?? null,
    error: input.error ?? null,
  };
}

export function completedSubagentResult(input: {
  agentId: string;
  agentName: string;
  report?: string;
  stepsDigest?: string;
  artifacts?: SubagentArtifacts;
  usage?: AiChatMessageUsage | null;
}): SubagentRunResult {
  return buildSubagentResult({
    status: "completed",
    agentId: input.agentId,
    agentName: input.agentName,
    report: input.report,
    stepsDigest: input.stepsDigest,
    artifacts: input.artifacts,
    usage: input.usage,
  });
}

export function failedSubagentResult(input: {
  agentId: string;
  agentName: string;
  error: string;
  report?: string;
  stepsDigest?: string;
  artifacts?: SubagentArtifacts;
  usage?: AiChatMessageUsage | null;
}): SubagentRunResult {
  return buildSubagentResult({
    status: "failed",
    agentId: input.agentId,
    agentName: input.agentName,
    report: input.report ?? input.error,
    stepsDigest: input.stepsDigest,
    artifacts: input.artifacts,
    usage: input.usage,
    error: input.error,
  });
}

export function abortedSubagentResult(input: {
  agentId: string;
  agentName: string;
  report?: string;
  stepsDigest?: string;
  artifacts?: SubagentArtifacts;
  usage?: AiChatMessageUsage | null;
}): SubagentRunResult {
  return buildSubagentResult({
    status: "aborted",
    agentId: input.agentId,
    agentName: input.agentName,
    report: input.report ?? "子代理运行已被用户中止。",
    stepsDigest: input.stepsDigest,
    artifacts: input.artifacts,
    usage: input.usage,
    error: "aborted",
  });
}
