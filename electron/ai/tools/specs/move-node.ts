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
      "将现有节点在同一 domain 内移动到现有文件夹下。domain 固定了树边界：manuscript 与 resource 互不相通，不能把 manuscript 节点移入 resource（或反向）。先用 read_structure 摘要或按 target 展开获取同域的 id 与 target_parent_id；不能移动根节点或移入自身后代。仅 manuscript 支持 index，resource 不得传 index。成功时返回移动后路径信息。",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          enum: ["manuscript", "resource"],
          description: "节点所属树；id 与 target_parent_id 必须同属该 domain，禁止跨域移动。",
        },
        id: {
          type: "string",
          description: "要移动的节点 ID（必须属于 domain 指定的树）。",
        },
        target_parent_id: {
          type: "string",
          description:
            "目标 folder 的节点 ID（必须与 id 同属 domain）；移动到根级时使用该 domain 树的 root_id，不得使用另一棵树的 root。",
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
