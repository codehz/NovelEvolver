import type { AiChatToolCall, AiSubagentToolView } from "@novelevolver/domain/ai";

import { toolActionLabel, truncateText } from "../tools/presenter-format";
import { getString, parseObject } from "../tools/presenter-parse";
import {
  describeSubagentProgressIndicator,
  progressUiFromToolView,
  readSubagentView,
  subagentPhaseLabel,
} from "../tools/subagent-progress-ui";
import { stripMarkdownPreview } from "../ui/strip-markdown-preview";

export type SubagentCardModel = {
  agentId: string;
  agentLabel: string;
  task: string;
  taskPreview: string;
  constraints: string | null;
  report: string | null;
  runStatus: AiSubagentToolView["runStatus"];
  statusLabel: string | null;
  liveIndicator: string | null;
  error: string | null;
  isError: boolean;
  isLive: boolean;
  wrote: boolean | null;
  touchedCount: number;
  phaseLabel: string | null;
  round: number;
  maxRounds: number;
  stepCount: number;
  view: AiSubagentToolView | null;
};

function runStatusLabel(status: AiSubagentToolView["runStatus"]): string | null {
  switch (status) {
    case "completed":
      return "完成";
    case "failed":
      return "失败";
    case "aborted":
      return "已中止";
    case "needs_user":
      return "需用户";
    default:
      return null;
  }
}

/** Pure selector for elevated subagent card UI (not model-facing). */
export function readSubagentCardModel(toolCall: AiChatToolCall): SubagentCardModel {
  const args = parseObject(toolCall.argumentsText);
  const view = readSubagentView(toolCall.view);
  const progress = progressUiFromToolView(toolCall.view);
  const result =
    toolCall.status === "complete" || toolCall.status === "error"
      ? parseObject(toolCall.resultText)
      : null;

  const agentId =
    view?.agentId ?? getString(result, "agent_id") ?? getString(args, "agent_id") ?? "未知 Agent";
  const agentName = view?.agentName ?? getString(result, "agent_name") ?? null;
  const task =
    (view?.task && view.task !== "" ? view.task : null) ?? getString(args, "task") ?? "未指定任务";
  const constraints = view?.constraints ?? getString(args, "constraints");
  const report =
    view?.report ?? getString(result, "report") ?? getString(result, "summary") ?? null;
  const runStatus =
    view?.runStatus ??
    (getString(result, "status") as AiSubagentToolView["runStatus"] | null) ??
    null;
  const error = getString(result, "error") ?? toolCall.errorMessage;
  const isLive =
    toolCall.status === "pending" ||
    toolCall.status === "running" ||
    toolCall.status === "awaiting_user";
  const liveIndicator =
    progress != null && toolCall.status === "running"
      ? describeSubagentProgressIndicator(progress)
      : toolCall.status === "running"
        ? "进行中"
        : null;

  return {
    agentId,
    agentLabel: agentName ?? agentId,
    task,
    taskPreview: truncateText(stripMarkdownPreview(task), 48),
    constraints,
    report,
    runStatus,
    statusLabel: runStatusLabel(runStatus),
    liveIndicator,
    error,
    isError: toolCall.status === "error" || runStatus === "failed",
    isLive,
    wrote: view?.artifacts.wrote ?? null,
    touchedCount: view?.artifacts.touched.length ?? 0,
    phaseLabel: view ? subagentPhaseLabel(view.phase) : null,
    round: view?.round ?? 0,
    maxRounds: view?.maxRounds ?? 0,
    stepCount: view?.steps.length ?? 0,
    view,
  };
}

export function describeSubagentCardSummary(model: SubagentCardModel): string {
  const chunks = [model.agentLabel, model.taskPreview];
  // Live step counts are noise (partial/changing); keep only after completion.
  if (!model.isLive && model.stepCount > 0) {
    chunks.push(`${model.stepCount} 步`);
  }
  const status = model.statusLabel ?? model.liveIndicator;
  if (status) {
    chunks.push(status);
  }
  return chunks.join(" · ");
}

export function mapSubagentStepStatus(
  status: AiSubagentToolView["steps"][number]["status"],
): "running" | "error" | "complete" {
  if (status === "error") return "error";
  if (status === "running") return "running";
  return "complete";
}

export function describeSubagentStepLine(step: AiSubagentToolView["steps"][number]): {
  title: string;
  subject: string | null;
  outcome: string | null;
} {
  return {
    title: toolActionLabel(step.name),
    subject: step.subject,
    outcome: step.outcome,
  };
}
