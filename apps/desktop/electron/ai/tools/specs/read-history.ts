import type { HistoryEntry } from "#shared/rpc/worktree/index";

import {
  parseDocumentDomain,
  parseHistoryLimit,
  parseNonEmptyString,
  parseToolArgs,
} from "../parse";
import type { ToolSpec } from "../types";

type HistoryEntryDto = {
  id: string;
  source: HistoryEntry["source"];
  revision_source?: HistoryEntry["revisionSource"];
  actor?: HistoryEntry["actor"];
  kind: HistoryEntry["kind"];
  domain: HistoryEntry["domain"];
  entity_id: string;
  label: string;
  display_path: string;
  timestamp: number;
  message: string;
  stats?: { added: number; removed: number };
  commit_hash?: string;
  short_hash?: string;
  author_name?: string;
  revision_id?: string;
  operation_id?: string;
  group_id?: string;
  has_content: boolean;
};

function toHistoryEntryDto(entry: HistoryEntry): HistoryEntryDto {
  return {
    id: entry.id,
    source: entry.source,
    revision_source: entry.revisionSource,
    actor: entry.actor,
    kind: entry.kind,
    domain: entry.domain,
    entity_id: entry.entityId,
    label: entry.label,
    display_path: entry.displayPath,
    timestamp: entry.timestamp,
    message: entry.message,
    stats:
      entry.stats === undefined
        ? undefined
        : { added: entry.stats.added, removed: entry.stats.removed },
    commit_hash: entry.commitHash,
    short_hash: entry.shortHash,
    author_name: entry.authorName,
    revision_id: entry.revisionId,
    operation_id: entry.operationId,
    group_id: entry.groupId,
    has_content: entry.hasContent,
  };
}

export const readHistorySpec: ToolSpec<"read_history"> = {
  name: "read_history",
  definition: {
    description:
      "列出一个章节或资源文件的历史元数据，不返回历史正文。id 使用 read_structure 返回的节点 ID；需要正文时再用返回条目的 id 调用 read_history_entry。",
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
        limit: {
          type: "integer",
          description: "可选，最多返回条数，默认 50，最大 200。",
          minimum: 1,
          maximum: 200,
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
    const limit = parseHistoryLimit(args.limit);
    const target = worktree.getTextDocumentInfo(domain, id);
    const entries = worktree.listFileHistory({ domain, entityId: id }, limit);

    return {
      target: {
        domain: target.domain,
        id: target.id,
        kind: target.kind,
        label: target.label,
        display_path: target.displayPath,
      },
      entries: entries.map(toHistoryEntryDto),
    };
  },
};
