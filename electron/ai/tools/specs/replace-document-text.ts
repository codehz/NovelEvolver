import { parseDocumentTarget, parseNonEmptyString, parseToolArgs } from "../parse";
import { withWriteStats } from "../text-stats";
import type { ToolSpec } from "../types";

export const replaceDocumentTextSpec: ToolSpec<"replace_document_text"> = {
  name: "replace_document_text",
  definition: {
    description:
      "精确替换章节或资源文件中的一段文字，适合局部修订且无需回传完整全文。必须先读取当前正文；expected_text 必须在正文中恰好出现一次，否则失败且不修改。可用空 replacement_text 删除该段。多个互不依赖的替换应逐次调用。成功时返回 stats / previous_stats / delta 与更新后的 worktree revision。",
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
        expected_text: {
          type: "string",
          description: "当前正文中恰好出现一次的非空原文片段；应包含足够上下文以保证唯一。",
        },
        replacement_text: {
          type: "string",
          description: "替换片段，允许空字符串。",
        },
      },
      required: ["target", "expected_text", "replacement_text"],
      additionalProperties: false,
    },
  },
  run({ worktree, call }) {
    const args = parseToolArgs(call);
    const target = parseDocumentTarget(args.target);
    const expectedText = parseNonEmptyString(args.expected_text, "expected_text");
    if (typeof args.replacement_text !== "string") {
      throw new Error("replacement_text 需要字符串。");
    }

    const currentContent =
      target.domain === "manuscript"
        ? worktree.readChapter(target.id)
        : worktree.readResourceFile(target.id);
    const firstIndex = currentContent.indexOf(expectedText);
    if (firstIndex < 0) {
      throw new Error("expected_text 不存在于当前内容中；请重新读取正文并提供精确原文。");
    }
    if (currentContent.indexOf(expectedText, firstIndex + expectedText.length) >= 0) {
      throw new Error("expected_text 在当前内容中出现多次；请增加上下文使其唯一。");
    }

    const nextContent =
      currentContent.slice(0, firstIndex) +
      args.replacement_text +
      currentContent.slice(firstIndex + expectedText.length);
    if (target.domain === "manuscript") {
      worktree.writeChapter(target.id, nextContent);
    } else {
      worktree.writeResourceFile(target.id, nextContent);
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
      replacements: 1,
      updated: true,
      ...withWriteStats(currentContent, nextContent),
      revision: worktree.getChangesSnapshot().revision,
    };
  },
};
