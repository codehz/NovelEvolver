import {
  parseDocumentDomain,
  parseNonEmptyString,
  parseOptionalIndex,
  parseToolArgs,
} from "../parse";
import type { ToolSpec } from "../types";
import { findCreatedNodePath } from "../worktree-helpers";

export const createFolderSpec: ToolSpec<"create_folder"> = {
  name: "create_folder",
  definition: {
    description:
      "在现有文件夹下创建文件夹。先用 read_structure 摘要或按 target 展开获取 parent_id；manuscript 可指定 index，resource 不得传 index。成功时返回新节点信息与更新后的 worktree revision。",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          enum: ["manuscript", "resource"],
          description: "节点所属树。",
        },
        parent_id: {
          type: "string",
          description:
            "对应树中现有 folder 的 ID；根级创建使用 read_structure 返回的对应 root_id。",
        },
        name: {
          type: "string",
          description: "新文件夹的标题或名称。",
        },
        index: {
          type: "integer",
          minimum: 0,
          description:
            "仅 manuscript 可用；在父节点 children 中的 0-based 插入位置，省略时追加。resource 不得传入。",
        },
      },
      required: ["domain", "parent_id", "name"],
      additionalProperties: false,
    },
  },
  run({ worktree, call }) {
    const args = parseToolArgs(call);
    const domain = parseDocumentDomain(args.domain, "domain");
    const parentId = parseNonEmptyString(args.parent_id, "parent_id");
    const name = parseNonEmptyString(args.name, "name");
    const index = parseOptionalIndex(args.index);

    if (domain === "manuscript") {
      const created = worktree.createManuscriptFolder(parentId, name, index);
      return {
        domain,
        kind: "folder" as const,
        id: created.nodeId,
        parent_id: parentId,
        name,
        display_path: findCreatedNodePath(worktree, domain, parentId, created.nodeId),
        revision: worktree.getChangesSnapshot().revision,
      };
    }

    if (index !== undefined) {
      throw new Error("resource 文件夹创建不支持 index。");
    }

    const created = worktree.createResourceFolder(parentId, name);
    return {
      domain,
      kind: "folder" as const,
      id: created.nodeId,
      parent_id: parentId,
      name,
      display_path: findCreatedNodePath(worktree, domain, parentId, created.nodeId),
      revision: worktree.getChangesSnapshot().revision,
    };
  },
};
