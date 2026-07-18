import {
  parseDocumentDomain,
  parseNonEmptyString,
  parseOptionalIndex,
  parseToolArgs,
} from "../parse";
import { withWriteStats } from "../text-stats";
import type { ToolSpec } from "../types";
import { findCreatedNodePath } from "../worktree-helpers";

export const createDocumentSpec: ToolSpec<"create_document"> = {
  name: "create_document",
  definition: {
    description:
      "在现有文件夹下创建带完整初始正文的文本节点。先用 read_structure 摘要或按 target 展开获取 parent_id；manuscript 创建 chapter 且可指定 index，resource 创建 file 且不得传 index。content 必须提供，本次调用应直接写入最终正文，不要先创建空节点再读取或编辑。成功时返回新节点信息、stats / previous_stats / delta 与该文档 content revision。",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          enum: ["manuscript", "resource"],
          description: "节点所属树；决定创建 chapter 或 file。",
        },
        parent_id: {
          type: "string",
          description:
            "对应树中现有 folder 的 ID；根级创建使用 read_structure 返回的对应 root_id。",
        },
        name: {
          type: "string",
          description: "新章节的标题或资源文件的名称。",
        },
        content: {
          type: "string",
          description: "创建时一次写入的完整初始正文；必须显式提供，允许确实需要的空字符串。",
        },
        index: {
          type: "integer",
          minimum: 0,
          description:
            "仅 manuscript 可用；在父节点 children 中的 0-based 插入位置，省略时追加。resource 不得传入。",
        },
      },
      required: ["domain", "parent_id", "name", "content"],
      additionalProperties: false,
    },
  },
  run({ worktree, call }) {
    const args = parseToolArgs(call);
    const domain = parseDocumentDomain(args.domain, "domain");
    const parentId = parseNonEmptyString(args.parent_id, "parent_id");
    const name = parseNonEmptyString(args.name, "name");
    const index = parseOptionalIndex(args.index);
    if (typeof args.content !== "string") {
      throw new Error("content 需要字符串。");
    }

    const writeStats = withWriteStats("", args.content);

    if (domain === "manuscript") {
      const created = worktree.createManuscriptChapter(parentId, name, index);
      worktree.writeChapter(created.nodeId, args.content);
      return {
        domain,
        kind: "chapter" as const,
        id: created.nodeId,
        parent_id: parentId,
        name,
        display_path: findCreatedNodePath(worktree, domain, parentId, created.nodeId),
        ...writeStats,
        revision: worktree.getDocumentContentRevision(domain, created.nodeId),
      };
    }

    if (index !== undefined) {
      throw new Error("resource 文件创建不支持 index。");
    }
    const created = worktree.createResourceFile(parentId, name);
    worktree.writeResourceFile(created.nodeId, args.content);
    return {
      domain,
      kind: "file" as const,
      id: created.nodeId,
      parent_id: parentId,
      name,
      display_path: findCreatedNodePath(worktree, domain, parentId, created.nodeId),
      ...writeStats,
      revision: worktree.getDocumentContentRevision(domain, created.nodeId),
    };
  },
};
