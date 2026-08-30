import {
  parseNonEmptyString,
  parseOptionalBoolean,
  parseOptionalPositiveInt,
  parseScopeDomain,
  parseToolArgs,
} from "../parse";
import type { ToolSpec } from "../types";

export const searchDocumentsSpec: ToolSpec<"search_documents"> = {
  name: "search_documents",
  definition: {
    description:
      "搜索章节和资源文件正文，用于定位内容所在节点；默认字面匹配，可开启 is_regex 使用 ECMAScript 正则。返回命中节点 ID、路径、1-based 行列号和片段。需要浏览目录结构时改用 read_structure。",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索关键词；is_regex 为 true 时解释为正则表达式（大小写不敏感）。",
        },
        is_regex: {
          type: "boolean",
          description: "是否将 query 作为正则表达式；省略时为 false（字面匹配）。",
        },
        scope: {
          type: "string",
          enum: ["manuscript", "resource", "all"],
          description: '搜索域；省略时为 "all"。',
        },
        max_results: {
          type: "integer",
          description: "每个域的最大命中数；省略时使用系统默认值。",
          minimum: 1,
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  run({ worktree, call }) {
    const args = parseToolArgs(call);
    const query = parseNonEmptyString(args.query, "query");
    const isRegex = parseOptionalBoolean(args.is_regex, "is_regex") ?? false;
    const scope = parseScopeDomain(args.scope, "scope");
    const maxResults = parseOptionalPositiveInt(args.max_results, "max_results");

    const result = worktree.searchWorktree({
      query,
      scope,
      isRegex,
      maxResultsPerDomain: maxResults,
    });

    return {
      query: result.query,
      scope: result.scope,
      is_regex: result.isRegex,
      manuscript_hits: result.manuscript.map((hit) => ({
        domain: hit.domain,
        node_id: hit.nodeId,
        entity_kind: hit.entityKind,
        label: hit.label,
        path: hit.displayPath,
        snippet: hit.snippet,
        line: hit.line,
        column: hit.column,
        match_length: hit.matchLength,
      })),
      resource_hits: result.resources.map((hit) => ({
        domain: hit.domain,
        node_id: hit.nodeId,
        entity_kind: hit.entityKind,
        label: hit.label,
        path: hit.displayPath,
        snippet: hit.snippet,
        line: hit.line,
        column: hit.column,
        match_length: hit.matchLength,
      })),
    };
  },
};
