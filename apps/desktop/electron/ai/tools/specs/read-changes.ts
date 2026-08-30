import type { Change } from "#domain/worktree";

import { parseScopeDomain, parseToolArgs } from "../parse";
import type { ToolSpec } from "../types";

type ChangeDto = {
  id: string;
  domain: "manuscript" | "resource";
  kind: Change["kind"];
  entity_id: string;
  entity_kind: Change["entityKind"];
  label: string;
  display_path: string;
  depth: number;
  order: number;
  stats?: { added: number; removed: number };
  previous_label?: string;
  previous_path?: string;
};

function toChangeDto(change: Change): ChangeDto {
  const dto: ChangeDto = {
    id: change.id,
    domain: change.domain,
    kind: change.kind,
    entity_id: change.entityId,
    entity_kind: change.entityKind,
    label: change.label,
    display_path: change.displayPath,
    depth: change.depth,
    order: change.order,
  };
  if (change.stats !== undefined) {
    dto.stats = { added: change.stats.added, removed: change.stats.removed };
  }
  if (change.kind === "rename") {
    dto.previous_label = change.previousLabel;
  }
  if (change.kind === "move" || change.kind === "reorder") {
    dto.previous_path = change.previousPath;
  }
  return dto;
}

export const readChangesSpec: ToolSpec<"read_changes"> = {
  name: "read_changes",
  definition: {
    description:
      "列出当前工作区相对分支基线的未提交变更及统计。用于发现哪些节点有新增、编辑、重命名、移动或删除；不会返回完整文本差异。",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          enum: ["manuscript", "resource", "all"],
          description: '可选，限制返回的变更域；默认 "all"。',
        },
      },
      additionalProperties: false,
    },
  },
  run({ worktree, call }) {
    const args = parseToolArgs(call);
    const domain = parseScopeDomain(args.domain, "domain");
    const snapshot = worktree.getChangesSnapshot();
    const manuscriptChanges = snapshot.manuscriptChanges.map(toChangeDto);
    const resourceChanges = snapshot.resourceChanges.map(toChangeDto);
    const filteredManuscript = domain === "resource" ? [] : manuscriptChanges;
    const filteredResource = domain === "manuscript" ? [] : resourceChanges;

    return {
      domain,
      revision: snapshot.revision,
      base_tree: snapshot.baseTree,
      has_changes: filteredManuscript.length > 0 || filteredResource.length > 0,
      warning: snapshot.warning,
      manuscript_changes: filteredManuscript,
      resource_changes: filteredResource,
    };
  },
};
