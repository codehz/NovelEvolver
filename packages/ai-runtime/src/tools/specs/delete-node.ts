import { parseDocumentDomain, parseNonEmptyString, parseToolArgs } from "../parse";
import type { ToolSpec } from "../types";

export const deleteNodeSpec: ToolSpec<"delete_node"> = {
  name: "delete_node",
  definition: {
    description:
      "永久删除一个现有节点，文件夹会递归删除后代。先用 read_structure 获取并核对节点 id 及其后代后再删除。成功时返回被删节点信息。",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          enum: ["manuscript", "resource"],
        },
        id: {
          type: "string",
          description: "read_structure 返回的节点 ID。",
        },
      },
      required: ["domain", "id"],
      additionalProperties: false,
    },
  },
  run({ worktree, call }) {
    const args = parseToolArgs(call);
    const domain = parseDocumentDomain(args.domain, "domain");
    const id = parseNonEmptyString(args.id, "id");
    const deleted = worktree.getProjectNodeInfo(domain, id);

    if (domain === "manuscript") {
      worktree.deleteManuscriptNode(id);
    } else {
      worktree.deleteResourceNode(id);
    }

    return {
      domain,
      id,
      kind: deleted.kind,
      label: deleted.label,
      display_path: deleted.displayPath,
      deleted: true,
    };
  },
};
