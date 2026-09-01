import type { ToolCallItem } from "@codehz/ai";

import { parseDocumentDomain, parseNonEmptyString, parseToolArgs } from "../../tools/parse";
import { formatFocusSnapshotsForPrompt, type FocusSnapshot } from "./focus-inject";
import { parseOptionalOutputTarget, type SubagentOutputTarget } from "./output-write";
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
  outputTarget: SubagentOutputTarget | null;
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

export type ParseRunSubagentArgsOptions = {
  /** Override parent_summary char budget (defaults to policy constant). */
  maxParentSummaryChars?: number;
};

/** Parse and normalize `run_subagent` tool arguments from a tool call. */
export function parseRunSubagentArgs(
  call: ToolCallItem,
  options?: ParseRunSubagentArgsOptions,
): RunSubagentArgs {
  const args = parseToolArgs(call);
  const agentId = parseNonEmptyString(args.agent_id, "agent_id").trim();
  const task = parseNonEmptyString(args.task, "task").trim();
  const constraints = parseOptionalTrimmedString(args.constraints, "constraints");
  const focus = parseFocus(args.focus);
  const parentSummary = truncateParentSummary(
    parseOptionalTrimmedString(args.parent_summary, "parent_summary"),
    options?.maxParentSummaryChars,
  );

  return {
    agentId,
    task,
    constraints,
    focus,
    parentSummary,
    outputTarget: parseOptionalOutputTarget(args.output_target),
  };
}

export type BuildSubagentUserMessageOptions = {
  /** Char budget used when formatting truncated focus notes. */
  maxFocusContentChars?: number;
  /** When set, final assistant reply is persisted to this document by the executor. */
  outputTarget?: {
    domain: "manuscript" | "resource";
    id: string;
    label: string;
    displayPath: string;
  } | null;
};

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
  options?: BuildSubagentUserMessageOptions,
): string {
  const lines: string[] = [
    `你是子代理「${agentName}」，正在执行一次独立委派任务。`,
    "不要假设父对话历史；仅依据下列任务说明、系统预载的焦点内容，以及你通过工具另行读取的项目内容作答。",
  ];

  if (options?.outputTarget) {
    lines.push(
      "你的最终回复将由执行器自动写入指定项目文档；不要在回复中说明「已写入」或使用元话语包装正文。",
      "",
      "## 输出目标",
      `- 文档：${options.outputTarget.displayPath}（${options.outputTarget.label}）`,
      `- 节点：${options.outputTarget.domain} id=${options.outputTarget.id}`,
      "- 最终回复必须是可直接落盘的纯正文：不要「以下是…」「好的，我来…」等前言，也不要 Markdown 说明或变更摘要。",
    );
  } else {
    lines.push("完成后用简洁中文给出结论、发现与（如有）已做改动摘要。");
  }

  lines.push("", "## 任务", args.task);

  if (args.constraints) {
    lines.push("", "## 约束", args.constraints);
  }

  if (focusSnapshots.length > 0) {
    lines.push(
      "",
      formatFocusSnapshotsForPrompt(focusSnapshots, {
        maxFocusContentChars: options?.maxFocusContentChars,
      }),
    );
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
