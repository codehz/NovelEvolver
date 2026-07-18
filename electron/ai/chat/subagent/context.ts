import type { ToolCallItem } from "@codehz/ai";

import { parseDocumentDomain, parseNonEmptyString, parseToolArgs } from "../../tools/parse";
import { formatFocusSnapshotsForPrompt, type FocusSnapshot } from "./focus-inject";
import { truncateParentSummary } from "./policy";

export type SubagentFocusTarget = {
  domain: "manuscript" | "resource";
  id: string;
};

export type RunSubagentArgs = {
  agentId: string;
  task: string;
  constraints: string | null;
  focus: SubagentFocusTarget[];
  parentSummary: string | null;
};

function parseFocusEntry(value: unknown, index: number): SubagentFocusTarget {
  if (typeof value !== "object" || value === null) {
    throw new Error(`focus[${index}] 必须是对象。`);
  }
  const entry = value as Record<string, unknown>;
  return {
    domain: parseDocumentDomain(entry.domain, `focus[${index}].domain`),
    id: parseNonEmptyString(entry.id, `focus[${index}].id`),
  };
}

function parseFocus(value: unknown): SubagentFocusTarget[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("focus 必须是对象数组。");
  }
  return value.map((entry, index) => parseFocusEntry(entry, index));
}

function parseOptionalTrimmedString(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`${fieldName} 必须是字符串。`);
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Parse and normalize `run_subagent` tool arguments from a tool call. */
export function parseRunSubagentArgs(call: ToolCallItem): RunSubagentArgs {
  const args = parseToolArgs(call);
  const agentId = parseNonEmptyString(args.agent_id, "agent_id").trim();
  const task = parseNonEmptyString(args.task, "task").trim();
  const constraints = parseOptionalTrimmedString(args.constraints, "constraints");
  const focus = parseFocus(args.focus);
  const parentSummary = truncateParentSummary(
    parseOptionalTrimmedString(args.parent_summary, "parent_summary"),
  );

  return {
    agentId,
    task,
    constraints,
    focus,
    parentSummary,
  };
}

/**
 * Build the isolated user message for a subagent run.
 * Does not include parent conversation history.
 * When `focusSnapshots` is provided, injects resolved node content/structure
 * so the child need not spend a tool round re-reading focus targets.
 */
export function buildSubagentUserMessage(
  args: RunSubagentArgs,
  agentName: string,
  focusSnapshots: readonly FocusSnapshot[] = [],
): string {
  const lines: string[] = [
    `你是子代理「${agentName}」，正在执行一次独立委派任务。`,
    "不要假设父对话历史；仅依据下列任务说明、系统预载的焦点内容，以及你通过工具另行读取的项目内容作答。",
    "完成后用简洁中文给出结论、发现与（如有）已做改动摘要。",
    "",
    "## 任务",
    args.task,
  ];

  if (args.constraints) {
    lines.push("", "## 约束", args.constraints);
  }

  if (focusSnapshots.length > 0) {
    lines.push("", formatFocusSnapshotsForPrompt(focusSnapshots));
  } else if (args.focus.length > 0) {
    // Fallback when worktree resolution was skipped (e.g. unit tests without session).
    lines.push("", "## 焦点节点");
    for (const target of args.focus) {
      lines.push(`- ${target.domain} id=${target.id}`);
    }
    lines.push("优先围绕上述节点读取与操作；需要关联设定时再自行搜索。");
  }

  if (args.parentSummary) {
    lines.push("", "## 父代理背景（极短）", args.parentSummary);
  }

  return lines.join("\n");
}
