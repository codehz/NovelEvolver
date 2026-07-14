import { parseDocumentTarget, parseToolArgs } from "../parse";
import { computeTextStats } from "../text-stats";
import type { ToolSpec } from "../types";

export const readDocumentSpec: ToolSpec<"read_document"> = {
  name: "read_document",
  definition: {
    description:
      "读取一个可编辑文本节点的当前全文与 worktree revision。manuscript 仅支持 chapter，resource 仅支持 file；id 必须使用 read_structure 摘要或逐层展开返回的节点 ID。写回前应使用返回的 revision 作为 expected_revision。结果含 stats（char_count / line_count / word_count）。",
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
              description: "read_structure 返回的 chapter 或 file 节点 ID，不是名称或路径。",
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
    const info = worktree.getTextDocumentInfo(target.domain, target.id);
    const content =
      target.domain === "manuscript"
        ? worktree.readChapter(target.id)
        : worktree.readResourceFile(target.id);
    return {
      target: {
        domain: info.domain,
        id: info.id,
        kind: info.kind,
        label: info.label,
        display_path: info.displayPath,
      },
      content,
      stats: computeTextStats(content),
      revision: worktree.getChangesSnapshot().revision,
    };
  },
};
