import { toolActionLabel } from "./presenter-format";

/** UI-side parse of `AiChatToolCall.progressText` for `run_subagent`. */

export type SubagentProgressUiPhase = "starting" | "thinking" | "tool" | "finalizing";

export type SubagentProgressUiTool = {
  name: string;
  status: "running" | "complete" | "error";
};

export type SubagentProgressUi = {
  agentId: string;
  agentName: string;
  phase: SubagentProgressUiPhase;
  round: number;
  maxRounds: number;
  currentTool: SubagentProgressUiTool | null;
  recentTools: SubagentProgressUiTool[];
  partialSummary: string;
  wrote: boolean;
  touchedCount: number;
};

function isPhase(value: unknown): value is SubagentProgressUiPhase {
  return value === "starting" || value === "thinking" || value === "tool" || value === "finalizing";
}

function parseTool(value: unknown): SubagentProgressUiTool | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.name !== "string") {
    return null;
  }
  if (record.status !== "running" && record.status !== "complete" && record.status !== "error") {
    return null;
  }
  return { name: record.name, status: record.status };
}

export function parseSubagentProgressUi(
  text: string | null | undefined,
): SubagentProgressUi | null {
  if (typeof text !== "string" || text.trim() === "") {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (record.kind !== "subagent_progress") {
      return null;
    }
    if (typeof record.agent_id !== "string" || typeof record.agent_name !== "string") {
      return null;
    }
    if (!isPhase(record.phase)) {
      return null;
    }

    const recentTools: SubagentProgressUiTool[] = [];
    if (Array.isArray(record.recent_tools)) {
      for (const entry of record.recent_tools) {
        const tool = parseTool(entry);
        if (tool) {
          recentTools.push(tool);
        }
      }
    }

    const artifacts =
      typeof record.artifacts === "object" &&
      record.artifacts !== null &&
      !Array.isArray(record.artifacts)
        ? (record.artifacts as Record<string, unknown>)
        : {};

    return {
      agentId: record.agent_id,
      agentName: record.agent_name,
      phase: record.phase,
      round: typeof record.round === "number" ? record.round : 0,
      maxRounds: typeof record.max_rounds === "number" ? record.max_rounds : 8,
      currentTool: parseTool(record.current_tool),
      recentTools,
      partialSummary: typeof record.partial_summary === "string" ? record.partial_summary : "",
      wrote: artifacts.wrote === true,
      touchedCount: typeof artifacts.touched_count === "number" ? artifacts.touched_count : 0,
    };
  } catch {
    return null;
  }
}

export function subagentPhaseLabel(phase: SubagentProgressUiPhase): string {
  switch (phase) {
    case "starting":
      return "启动中";
    case "thinking":
      return "思考中";
    case "tool":
      return "调用工具";
    case "finalizing":
      return "收尾中";
  }
}

export function describeSubagentProgressIndicator(progress: SubagentProgressUi): string {
  const roundLabel = progress.round > 0 ? `第${progress.round}/${progress.maxRounds}轮` : null;
  if (progress.phase === "tool" && progress.currentTool) {
    const toolLabel = toolActionLabel(progress.currentTool.name);
    return roundLabel ? `${toolLabel} · ${roundLabel}` : toolLabel;
  }
  const phase = subagentPhaseLabel(progress.phase);
  return roundLabel ? `${phase} · ${roundLabel}` : phase;
}

export function describeRunningSubagentStatus(progress: SubagentProgressUi): string {
  const phase = subagentPhaseLabel(progress.phase);
  const name = progress.agentName || progress.agentId;
  if (progress.phase === "tool" && progress.currentTool) {
    return `子代理 · ${name} · ${toolActionLabel(progress.currentTool.name)}`;
  }
  return `子代理 · ${name} · ${phase}`;
}
