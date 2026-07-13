import { parseDocumentDomain, parseNonEmptyString, parseToolArgs } from "../parse";
import type { ToolSpec } from "../types";

export const renameNodeSpec: ToolSpec<"rename_node"> = {
  name: "rename_node",
  definition: {
    description:
      "重命名一个现有节点，不修改正文。先用 read_structure 获取节点 id；name 传新标题或新名称，而不是路径。成功时返回更新后的 worktree revision。",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          enum: ["manuscript", "resource"],
        },
        id: {
          type: "string",
        },
        name: {
          type: "string",
          description: "新标题（手稿）或新名称（资源）。",
        },
      },
      required: ["domain", "id", "name"],
      additionalProperties: false,
    },
  },
  run({ worktree, call }) {
    const args = parseToolArgs(call);
    const domain = parseDocumentDomain(args.domain, "domain");
    const id = parseNonEmptyString(args.id, "id");
    const name = parseNonEmptyString(args.name, "name");
    const previous = worktree.getProjectNodeInfo(domain, id);

    if (domain === "manuscript") {
      worktree.renameManuscriptNode(id, name);
    } else {
      worktree.renameResourceNode(id, name);
    }

    const current = worktree.getProjectNodeInfo(domain, id);
    return {
      domain,
      id,
      kind: current.kind,
      previous_label: previous.label,
      previous_display_path: previous.displayPath,
      display_path: current.displayPath,
      name,
      renamed: true,
      revision: worktree.getChangesSnapshot().revision,
    };
  },
};
