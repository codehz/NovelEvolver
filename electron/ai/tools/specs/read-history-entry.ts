import { parseNonEmptyString, parseToolArgs } from "../parse";
import type { ToolSpec } from "../types";

export const readHistoryEntrySpec: ToolSpec<"read_history_entry"> = {
  name: "read_history_entry",
  definition: {
    description:
      "读取一条历史记录保存的 content 和 before_content。entry_id 必须来自 read_history 返回的条目 id，不能传文档节点 id；无可用正文时字段为 null。",
    inputSchema: {
      type: "object",
      properties: {
        entry_id: {
          type: "string",
          description: "read_history 返回的历史条目 id。",
        },
      },
      required: ["entry_id"],
      additionalProperties: false,
    },
  },
  run({ worktree, call }) {
    const args = parseToolArgs(call);
    const entryId = parseNonEmptyString(args.entry_id, "entry_id");
    const entry = worktree.readHistoryEntry(entryId);
    const content = worktree.readHistoryEntryContent(entryId);

    return {
      entry_id: entryId,
      domain: entry.domain,
      entity_id: entry.entityId,
      label: entry.label,
      display_path: entry.displayPath,
      timestamp: entry.timestamp,
      content: content.content,
      before_content: content.beforeContent ?? null,
    };
  },
};
