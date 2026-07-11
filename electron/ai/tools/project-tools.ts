import type { ToolCallItem } from "@codehz/ai";

import type {
  AiProjectStructure,
  AiProjectStructureDomain,
  AiProjectStructureManuscriptNode,
  AiProjectStructureResourceNode,
  WorktreeSession,
} from "../../worktree/session";
import { parseToolArgs } from "./utils";

type ProjectStructureTree<TNode> = {
  root_id: string;
  nodes: TNode[];
};

type ProjectStructureManuscriptNodeDto = {
  id: string;
  domain: "manuscript";
  kind: "folder" | "chapter";
  title: string;
  parent_id: string | null;
  child_ids: string[];
  display_path: string;
};

type ProjectStructureResourceNodeDto = {
  id: string;
  domain: "resource";
  kind: "folder" | "file";
  name: string;
  parent_id: string | null;
  child_ids: string[];
  display_path: string;
};

export type GetProjectStructureResult = {
  domain: AiProjectStructureDomain;
  manuscript?: ProjectStructureTree<ProjectStructureManuscriptNodeDto>;
  resource?: ProjectStructureTree<ProjectStructureResourceNodeDto>;
};

export type SearchProjectResult = {
  query: string;
  scope: "manuscript" | "resource" | "all";
  manuscript_hits: {
    domain: "manuscript";
    node_id: string;
    entity_kind: "chapter";
    label: string;
    path: string;
    snippet: string;
    line: number;
    column: number;
    match_length: number;
  }[];
  resource_hits: {
    domain: "resource";
    node_id: string;
    entity_kind: "file";
    label: string;
    path: string;
    snippet: string;
    line: number;
    column: number;
    match_length: number;
  }[];
};

export type EditTextDocumentResult = {
  target: {
    domain: "manuscript" | "resource";
    id: string;
  };
  updated: true;
};

export type CreateDocumentResult = {
  domain: "manuscript" | "resource";
  kind: "chapter" | "file" | "folder";
  id: string;
  parent_id: string;
  name: string;
  display_path: string;
};

type ReadChapterArgs = {
  chapter_id?: unknown;
};

type SearchProjectArgs = {
  query?: unknown;
  scope?: unknown;
  max_results?: unknown;
};

type EditTextDocumentArgs = {
  target?: unknown;
  expected_content?: unknown;
  new_content?: unknown;
};

type CreateDocumentArgs = {
  domain?: unknown;
  kind?: unknown;
  parent_id?: unknown;
  name?: unknown;
  index?: unknown;
  content?: unknown;
};

function parseNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} 需要非空字符串。`);
  }
  return value;
}

function parseScopeDomain(value: unknown, fieldName: string): AiProjectStructureDomain {
  if (value === undefined) {
    return "all";
  }
  if (value === "manuscript" || value === "resource" || value === "all") {
    return value;
  }
  throw new Error(`${fieldName} 必须是 "manuscript"、"resource" 或 "all"。`);
}

function parseDocumentDomain(value: unknown, fieldName: string): "manuscript" | "resource" {
  if (value === "manuscript" || value === "resource") {
    return value;
  }
  throw new Error(`${fieldName} 必须是 "manuscript" 或 "resource"。`);
}

function parseOptionalIndex(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error("index 必须是整数。");
  }
  return value;
}

function parseDocumentKind(value: unknown): "chapter" | "file" | "folder" {
  if (value === "chapter" || value === "file" || value === "folder") {
    return value;
  }
  throw new Error('kind 必须是 "chapter"、"file" 或 "folder"。');
}

function toManuscriptNodeDto(
  node: AiProjectStructureManuscriptNode,
): ProjectStructureManuscriptNodeDto {
  return {
    id: node.id,
    domain: node.domain,
    kind: node.kind,
    title: node.title,
    parent_id: node.parentId,
    child_ids: [...node.childIds],
    display_path: node.displayPath,
  };
}

function toResourceNodeDto(node: AiProjectStructureResourceNode): ProjectStructureResourceNodeDto {
  return {
    id: node.id,
    domain: node.domain,
    kind: node.kind,
    name: node.name,
    parent_id: node.parentId,
    child_ids: [...node.childIds],
    display_path: node.displayPath,
  };
}

function toProjectStructureResult(structure: AiProjectStructure): GetProjectStructureResult {
  return {
    domain: structure.domain,
    manuscript:
      structure.manuscript === undefined
        ? undefined
        : {
            root_id: structure.manuscript.rootId,
            nodes: structure.manuscript.nodes.map(toManuscriptNodeDto),
          },
    resource:
      structure.resource === undefined
        ? undefined
        : {
            root_id: structure.resource.rootId,
            nodes: structure.resource.nodes.map(toResourceNodeDto),
          },
  };
}

function findCreatedNodePath(
  worktree: WorktreeSession,
  domain: "manuscript" | "resource",
  nodeId: string,
): string {
  const structure = worktree.getProjectStructure(domain);
  const nodes = domain === "manuscript" ? structure.manuscript?.nodes : structure.resource?.nodes;
  const node = nodes?.find((entry) => entry.id === nodeId);
  if (!node) {
    throw new Error(`创建后的节点不存在: ${nodeId}`);
  }
  return node.displayPath;
}

export function executeGetProjectStructure(
  worktree: WorktreeSession,
  call: ToolCallItem,
): GetProjectStructureResult {
  const args = parseToolArgs(call);
  const domain = parseScopeDomain(args.domain, "domain");
  return toProjectStructureResult(worktree.getProjectStructure(domain));
}

export function executeReadChapter(worktree: WorktreeSession, call: ToolCallItem): string {
  const args = parseToolArgs(call) as ReadChapterArgs;
  return worktree.readChapter(parseNonEmptyString(args.chapter_id, "chapter_id"));
}

export function executeSearchProject(
  worktree: WorktreeSession,
  call: ToolCallItem,
): SearchProjectResult {
  const args = parseToolArgs(call) as SearchProjectArgs;
  const query = parseNonEmptyString(args.query, "query");
  const scope = parseScopeDomain(args.scope, "scope");
  const maxResults = args.max_results;
  if (
    maxResults !== undefined &&
    (typeof maxResults !== "number" || !Number.isInteger(maxResults) || maxResults < 1)
  ) {
    throw new Error("max_results 必须是正整数。");
  }

  const result = worktree.searchWorktree({
    query,
    scope,
    maxResultsPerDomain: maxResults,
  });

  return {
    query: result.query,
    scope: result.scope,
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
}

export function executeEditTextDocument(
  worktree: WorktreeSession,
  call: ToolCallItem,
): EditTextDocumentResult {
  const args = parseToolArgs(call) as EditTextDocumentArgs;
  if (typeof args.target !== "object" || args.target === null) {
    throw new Error("target 需要对象参数。");
  }
  const target = args.target as Record<string, unknown>;
  const domain = parseDocumentDomain(target.domain, "target.domain");
  const id = parseNonEmptyString(target.id, "target.id");
  if (typeof args.expected_content !== "string") {
    throw new Error("expected_content 需要字符串。");
  }
  if (typeof args.new_content !== "string") {
    throw new Error("new_content 需要字符串。");
  }

  const currentContent =
    domain === "manuscript" ? worktree.readChapter(id) : worktree.readResourceFile(id);
  if (currentContent !== args.expected_content) {
    throw new Error("expected_content 与当前内容不匹配。");
  }

  if (domain === "manuscript") {
    worktree.writeChapter(id, args.new_content);
  } else {
    worktree.writeResourceFile(id, args.new_content);
  }

  return {
    target: {
      domain,
      id,
    },
    updated: true,
  };
}

export function executeCreateDocument(
  worktree: WorktreeSession,
  call: ToolCallItem,
): CreateDocumentResult {
  const args = parseToolArgs(call) as CreateDocumentArgs;
  const domain = parseDocumentDomain(args.domain, "domain");
  const kind = parseDocumentKind(args.kind);
  const parentId = parseNonEmptyString(args.parent_id, "parent_id");
  const name = parseNonEmptyString(args.name, "name");
  const index = parseOptionalIndex(args.index);
  const content = args.content;

  if (domain === "manuscript") {
    if (kind === "file") {
      throw new Error('manuscript 域不支持 kind="file"。');
    }
    if (typeof content !== "undefined") {
      throw new Error("manuscript 节点创建不支持 content。");
    }
    const created =
      kind === "chapter"
        ? worktree.createManuscriptChapter(parentId, name, index)
        : kind === "folder"
          ? worktree.createManuscriptFolder(parentId, name, index)
          : null;
    if (created === null) {
      throw new Error('manuscript 域的 kind 必须是 "chapter" 或 "folder"。');
    }
    return {
      domain,
      kind,
      id: created.nodeId,
      parent_id: parentId,
      name,
      display_path: findCreatedNodePath(worktree, domain, created.nodeId),
    };
  }

  if (kind === "chapter") {
    throw new Error('resource 域不支持 kind="chapter"。');
  }
  if (index !== undefined) {
    throw new Error("resource 节点创建不支持 index。");
  }

  if (kind === "folder") {
    if (typeof content !== "undefined") {
      throw new Error("resource 文件夹创建不支持 content。");
    }
    const created = worktree.createResourceFolder(parentId, name);
    return {
      domain,
      kind,
      id: created.nodeId,
      parent_id: parentId,
      name,
      display_path: findCreatedNodePath(worktree, domain, created.nodeId),
    };
  }

  if (kind !== "file") {
    throw new Error('resource 域的 kind 必须是 "file" 或 "folder"。');
  }
  if (typeof content !== "undefined" && typeof content !== "string") {
    throw new Error("content 需要字符串。");
  }

  const created = worktree.createResourceFile(parentId, name);
  const nextContent = typeof content === "string" ? content : "";
  if (nextContent !== "") {
    worktree.writeResourceFile(created.nodeId, nextContent);
  }
  return {
    domain,
    kind,
    id: created.nodeId,
    parent_id: parentId,
    name,
    display_path: findCreatedNodePath(worktree, domain, created.nodeId),
  };
}
