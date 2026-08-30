import type { AiSubagentToolView, AiToolView } from "#domain/ai";

import { toolActionLabel } from "./presenter-format";

export type SubagentProgressUiPhase = AiSubagentToolView["phase"];

export type SubagentProgressUiTool = {
  name: string;
  status: "running" | "complete" | "error";
};

/** UI-facing snapshot derived from `AiChatToolCall.view` when kind is subagent. */
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
  task: string;
  report: string | null;
  runStatus: AiSubagentToolView["runStatus"];
  steps: AiSubagentToolView["steps"];
};

export function readSubagentView(view: AiToolView | null | undefined): AiSubagentToolView | null {
  return view?.kind === "subagent" ? view : null;
}

export function subagentViewToProgressUi(view: AiSubagentToolView): SubagentProgressUi {
  const running = [...view.steps].reverse().find((step) => step.status === "running") ?? null;
  const recentTools = view.steps
    .filter((step) => step.status !== "running")
    .map((step) => ({ name: step.name, status: step.status }));

  return {
    agentId: view.agentId,
    agentName: view.agentName,
    phase: view.phase,
    round: view.round,
    maxRounds: view.maxRounds,
    currentTool: running ? { name: running.name, status: running.status } : null,
    recentTools,
    partialSummary: view.report ?? "",
    wrote: view.artifacts.wrote,
    touchedCount: view.artifacts.touched.length,
    task: view.task,
    report: view.report,
    runStatus: view.runStatus,
    steps: view.steps,
  };
}

export function progressUiFromToolView(
  view: AiToolView | null | undefined,
): SubagentProgressUi | null {
  const subagent = readSubagentView(view);
  return subagent ? subagentViewToProgressUi(subagent) : null;
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
    case "done":
      return "已完成";
  }
}

export function describeSubagentProgressIndicator(progress: SubagentProgressUi): string {
  const roundLabel = progress.round > 0 ? `第${progress.round}/${progress.maxRounds}轮` : null;
  if (progress.phase === "tool" && progress.currentTool) {
    const toolLabel = toolActionLabel(progress.currentTool.name);
    return roundLabel ? `${toolLabel} · ${roundLabel}` : toolLabel;
  }
  if (progress.phase === "done" && progress.runStatus) {
    const status =
      progress.runStatus === "completed"
        ? "完成"
        : progress.runStatus === "failed"
          ? "失败"
          : progress.runStatus === "aborted"
            ? "已中止"
            : "需用户";
    return status;
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
