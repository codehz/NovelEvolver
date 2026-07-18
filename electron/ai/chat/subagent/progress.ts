import { MAX_SUBAGENT_TOOL_ROUNDS } from "./policy";

/** Discriminator for JSON stored in `AiChatToolCall.progressText`. */
export const SUBAGENT_PROGRESS_KIND = "subagent_progress" as const;

export const PARTIAL_SUMMARY_THROTTLE_MS = 250;
export const PARTIAL_SUMMARY_MAX_CHARS = 400;
export const RECENT_TOOLS_MAX = 6;

export type SubagentProgressPhase = "starting" | "thinking" | "tool" | "finalizing";

export type SubagentProgressToolStatus = "running" | "complete" | "error";

export type SubagentProgressTool = {
  name: string;
  status: SubagentProgressToolStatus;
};

export type SubagentProgressArtifacts = {
  wrote: boolean;
  touched_count: number;
};

export type SubagentProgress = {
  kind: typeof SUBAGENT_PROGRESS_KIND;
  agent_id: string;
  agent_name: string;
  phase: SubagentProgressPhase;
  /** 1-based model round currently in progress (0 before first stream). */
  round: number;
  max_rounds: number;
  current_tool: SubagentProgressTool | null;
  /** Most recent completed child tools (oldest → newest, max RECENT_TOOLS_MAX). */
  recent_tools: SubagentProgressTool[];
  partial_summary: string;
  artifacts: SubagentProgressArtifacts;
};

export type BuildSubagentProgressInput = {
  agentId: string;
  agentName: string;
  phase: SubagentProgressPhase;
  round?: number;
  maxRounds?: number;
  currentTool?: SubagentProgressTool | null;
  recentTools?: readonly SubagentProgressTool[];
  partialSummary?: string;
  wrote?: boolean;
  touchedCount?: number;
};

/**
 * Keep the tail of a growing partial summary so the UI shows what the child is
 * currently writing rather than the intro.
 */
export function truncatePartialSummary(
  text: string,
  maxChars: number = PARTIAL_SUMMARY_MAX_CHARS,
): string {
  if (maxChars <= 0) {
    return "";
  }
  const trimmed = text.trimEnd();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  if (maxChars === 1) {
    return "…";
  }
  return `…${trimmed.slice(-(maxChars - 1))}`;
}

export function capRecentTools(
  tools: readonly SubagentProgressTool[],
  max: number = RECENT_TOOLS_MAX,
): SubagentProgressTool[] {
  if (max <= 0) {
    return [];
  }
  if (tools.length <= max) {
    return tools.map((tool) => ({ ...tool }));
  }
  return tools.slice(-max).map((tool) => ({ ...tool }));
}

export function phaseLabel(phase: SubagentProgressPhase): string {
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

export function buildSubagentProgress(input: BuildSubagentProgressInput): SubagentProgress {
  const recent = capRecentTools(input.recentTools ?? []);
  return {
    kind: SUBAGENT_PROGRESS_KIND,
    agent_id: input.agentId,
    agent_name: input.agentName,
    phase: input.phase,
    round: Math.max(0, Math.floor(input.round ?? 0)),
    max_rounds: Math.max(1, Math.floor(input.maxRounds ?? MAX_SUBAGENT_TOOL_ROUNDS)),
    current_tool: input.currentTool ? { ...input.currentTool } : null,
    recent_tools: recent,
    partial_summary: truncatePartialSummary(input.partialSummary ?? ""),
    artifacts: {
      wrote: input.wrote === true,
      touched_count: Math.max(0, Math.floor(input.touchedCount ?? 0)),
    },
  };
}

export function serializeSubagentProgress(progress: SubagentProgress): string {
  return JSON.stringify(progress);
}

export function parseSubagentProgress(text: string | null | undefined): SubagentProgress | null {
  if (typeof text !== "string" || text.trim() === "") {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (record.kind !== SUBAGENT_PROGRESS_KIND) {
      return null;
    }
    if (typeof record.agent_id !== "string" || typeof record.agent_name !== "string") {
      return null;
    }
    if (
      record.phase !== "starting" &&
      record.phase !== "thinking" &&
      record.phase !== "tool" &&
      record.phase !== "finalizing"
    ) {
      return null;
    }
    const recentRaw = Array.isArray(record.recent_tools) ? record.recent_tools : [];
    const recent_tools: SubagentProgressTool[] = [];
    for (const entry of recentRaw) {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        continue;
      }
      const tool = entry as Record<string, unknown>;
      if (typeof tool.name !== "string") {
        continue;
      }
      if (tool.status !== "running" && tool.status !== "complete" && tool.status !== "error") {
        continue;
      }
      recent_tools.push({ name: tool.name, status: tool.status });
    }

    let current_tool: SubagentProgressTool | null = null;
    if (typeof record.current_tool === "object" && record.current_tool !== null) {
      const tool = record.current_tool as Record<string, unknown>;
      if (
        typeof tool.name === "string" &&
        (tool.status === "running" || tool.status === "complete" || tool.status === "error")
      ) {
        current_tool = { name: tool.name, status: tool.status };
      }
    }

    const artifactsRaw =
      typeof record.artifacts === "object" &&
      record.artifacts !== null &&
      !Array.isArray(record.artifacts)
        ? (record.artifacts as Record<string, unknown>)
        : {};

    return buildSubagentProgress({
      agentId: record.agent_id,
      agentName: record.agent_name,
      phase: record.phase,
      round: typeof record.round === "number" ? record.round : 0,
      maxRounds:
        typeof record.max_rounds === "number" ? record.max_rounds : MAX_SUBAGENT_TOOL_ROUNDS,
      currentTool: current_tool,
      recentTools: recent_tools,
      partialSummary: typeof record.partial_summary === "string" ? record.partial_summary : "",
      wrote: artifactsRaw.wrote === true,
      touchedCount: typeof artifactsRaw.touched_count === "number" ? artifactsRaw.touched_count : 0,
    });
  } catch {
    return null;
  }
}

/**
 * Throttle helper for partial summary updates. Milestone events should call
 * `emitImmediate` / `forceFlush` instead of waiting for the interval.
 */
export function createProgressThrottle(options: {
  intervalMs?: number;
  onEmit: (progress: SubagentProgress) => void;
}): {
  schedule: (progress: SubagentProgress) => void;
  forceFlush: () => void;
  cancel: () => void;
} {
  const intervalMs = options.intervalMs ?? PARTIAL_SUMMARY_THROTTLE_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: SubagentProgress | null = null;
  let lastEmitAt = 0;

  const emit = (progress: SubagentProgress) => {
    lastEmitAt = Date.now();
    pending = null;
    options.onEmit(progress);
  };

  const schedule = (progress: SubagentProgress) => {
    pending = progress;
    const elapsed = Date.now() - lastEmitAt;
    if (elapsed >= intervalMs) {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      emit(progress);
      return;
    }
    if (timer !== null) {
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      if (pending) {
        emit(pending);
      }
    }, intervalMs - elapsed);
  };

  const forceFlush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending) {
      emit(pending);
    }
  };

  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    pending = null;
  };

  return { schedule, forceFlush, cancel };
}
