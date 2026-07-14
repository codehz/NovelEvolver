import { parseDocumentTarget, parseExpectedRevision, parseToolArgs } from "../parse";
import { withWriteStats } from "../text-stats";
import type { ToolSpec } from "../types";

export const writeDocumentSpec: ToolSpec<"write_document"> = {
  name: "write_document",
  definition: {
    description:
      "将一个章节或资源文件的全文替换为 new_content。仅在大范围重写时使用；局部修改优先用 replace_document_text。必须先调用 read_document，并将返回的 revision 作为 expected_revision；若工作区已变更则调用失败，应重新读取后再写。成功时返回 stats / previous_stats / delta。",
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
              description: "此前读取的 chapter 或 file 节点 ID。",
            },
          },
          required: ["domain", "id"],
          additionalProperties: false,
        },
        expected_revision: {
          type: "integer",
          description: "最近一次 read_document 返回的 worktree revision。",
          minimum: 0,
        },
        new_content: {
          type: "string",
          description: "替换后的完整全文；不是补丁或局部片段。允许空字符串。",
        },
      },
      required: ["target", "expected_revision", "new_content"],
      additionalProperties: false,
    },
  },
  run({ worktree, call }) {
    const args = parseToolArgs(call);
    const target = parseDocumentTarget(args.target);
    const expectedRevision = parseExpectedRevision(args.expected_revision);
    if (typeof args.new_content !== "string") {
      throw new Error("new_content 需要字符串。");
    }

    const currentRevision = worktree.getChangesSnapshot().revision;
    if (currentRevision !== expectedRevision) {
      throw new Error(
        `expected_revision 与当前工作区 revision 不匹配（expected=${expectedRevision}, current=${currentRevision}）；请重新 read_document 后再写。`,
      );
    }

    const previousContent =
      target.domain === "manuscript"
        ? worktree.readChapter(target.id)
        : worktree.readResourceFile(target.id);

    if (target.domain === "manuscript") {
      worktree.writeChapter(target.id, args.new_content);
    } else {
      worktree.writeResourceFile(target.id, args.new_content);
    }

    const info = worktree.getTextDocumentInfo(target.domain, target.id);
    return {
      target: {
        domain: info.domain,
        id: info.id,
        kind: info.kind,
        label: info.label,
        display_path: info.displayPath,
      },
      updated: true,
      ...withWriteStats(previousContent, args.new_content),
      revision: worktree.getChangesSnapshot().revision,
    };
  },
};
