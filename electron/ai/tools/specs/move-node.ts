import {
  parseDocumentDomain,
  parseNonEmptyString,
  parseOptionalIndex,
  parseToolArgs,
} from "../parse";
import type { ToolSpec } from "../types";

export const moveNodeSpec: ToolSpec<"move_node"> = {
  name: "move_node",
  definition: {
    description:
      "将现有节点移动到现有文件夹下。先用 read_structure 摘要或按 target 展开获取 id 和 target_parent_id；不能移动根节点或移入自身后代。仅 manuscript 支持 index，resource 不得传 index。成功时返回移动后路径信息。",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          enum: ["manuscript", "resource"],
        },
        id: {
          type: "string",
          description: "要移动的节点 ID。",
        },
        target_parent_id: {
          type: "string",
          description: "目标 folder 的节点 ID；移动到根级时使用对应树的 root_id。",
        },
        index: {
          type: "integer",
          description: "仅 manuscript 可用；目标 children 中的 0-based 插入位置，省略时追加。",
          minimum: 0,
        },
      },
      required: ["domain", "id", "target_parent_id"],
      additionalProperties: false,
    },
  },
  run({ worktree, call }) {
    const args = parseToolArgs(call);
    const domain = parseDocumentDomain(args.domain, "domain");
    const id = parseNonEmptyString(args.id, "id");
    const targetParentId = parseNonEmptyString(args.target_parent_id, "target_parent_id");
    const index = parseOptionalIndex(args.index);
    const previous = worktree.getProjectNodeInfo(domain, id);

    if (domain === "manuscript") {
      worktree.moveManuscriptNode(id, targetParentId, index);
    } else {
      if (index !== undefined) {
        throw new Error("resource 域移动不支持 index。");
      }
      worktree.moveResourceNode(id, targetParentId);
    }

    const current = worktree.getProjectNodeInfo(domain, id);
    return {
      domain,
      id,
      kind: current.kind,
      label: current.label,
      previous_display_path: previous.displayPath,
      display_path: current.displayPath,
      target_parent_id: targetParentId,
      moved: true,
    };
  },
};
