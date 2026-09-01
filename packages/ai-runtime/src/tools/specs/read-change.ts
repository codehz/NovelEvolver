import { parseDocumentTarget, parseToolArgs } from "../parse";
import { computeTextStats } from "../text-stats";
import type { ToolSpec } from "../types";

export const readChangeSpec: ToolSpec<"read_change"> = {
  name: "read_change",
  definition: {
    description:
      "读取一个未提交文本变更的基线全文 original_content 与当前全文 current_content。先调用 read_changes，并仅对其中可预览的 chapter/file 文本变更使用 entity_id；结构变更不可读取正文差异。结果含 original_stats 与 current_stats。",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              enum: ["manuscript", "resource"],
            },
            id: {
              type: "string",
            },
          },
          required: ["domain", "id"],
          additionalProperties: false,
        },
      },
      required: ["target"],
      additionalProperties: false,
    },
  },
  run({ worktree, call }) {
    const args = parseToolArgs(call);
    const target = parseDocumentTarget(args.target);
    const comparison = worktree.readChangeTextComparisonByTarget({
      domain: target.domain,
      entityId: target.id,
    });

    return {
      target: {
        domain: target.domain,
        id: target.id,
      },
      change_id: comparison.changeId,
      kind: comparison.kind,
      label: comparison.label,
      display_path: comparison.displayPath,
      original_content: comparison.originalContent,
      current_content: comparison.currentContent,
      original_stats: computeTextStats(comparison.originalContent),
      current_stats: computeTextStats(comparison.currentContent),
    };
  },
};
