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

export type ReadTextDocumentResult = {
  target: {
    domain: "manuscript" | "resource";
    id: string;
  };
  content: string;
  revision: number;
};

export type EditTextDocumentResult = {
  target: {
    domain: "manuscript" | "resource";
    id: string;
  };
  updated: true;
  revision: number;
};

export type ReplaceTextDocumentResult = {
  target: {
    domain: "manuscript" | "resource";
    id: string;
  };
  replacements: 1;
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

type ReadTextDocumentArgs = {
  target?: unknown;
};

type SearchProjectArgs = {
  query?: unknown;
  scope?: unknown;
  max_results?: unknown;
};

type EditTextDocumentArgs = {
  target?: unknown;
  expected_revision?: unknown;
  new_content?: unknown;
};

type ReplaceTextDocumentArgs = {
  target?: unknown;
  expected_text?: unknown;
  replacement_text?: unknown;
};

type CreateNodeArgs = {
  domain?: unknown;
  parent_id?: unknown;
  name?: unknown;
  index?: unknown;
};

type CreateTextDocumentArgs = CreateNodeArgs & {
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
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("index 必须是非负整数。");
  }
  return value;
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

export function executeReadTextDocument(
  worktree: WorktreeSession,
  call: ToolCallItem,
): ReadTextDocumentResult {
  const args = parseToolArgs(call) as ReadTextDocumentArgs;
  if (typeof args.target !== "object" || args.target === null) {
    throw new Error("target 需要对象参数。");
  }
  const target = args.target as Record<string, unknown>;
  const domain = parseDocumentDomain(target.domain, "target.domain");
  const id = parseNonEmptyString(target.id, "target.id");
  const content =
    domain === "manuscript" ? worktree.readChapter(id) : worktree.readResourceFile(id);
  return {
    target: { domain, id },
    content,
    revision: worktree.getChangesSnapshot().revision,
  };
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

function parseExpectedRevision(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("expected_revision 必须是非负整数。");
  }
  return value;
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
  const expectedRevision = parseExpectedRevision(args.expected_revision);
  if (typeof args.new_content !== "string") {
    throw new Error("new_content 需要字符串。");
  }

  const currentRevision = worktree.getChangesSnapshot().revision;
  if (currentRevision !== expectedRevision) {
    throw new Error(
      `expected_revision 与当前工作区 revision 不匹配（expected=${expectedRevision}, current=${currentRevision}）；请重新 read_document 后再写。`,
    );
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
    revision: worktree.getChangesSnapshot().revision,
  };
}

export function executeReplaceTextDocument(
  worktree: WorktreeSession,
  call: ToolCallItem,
): ReplaceTextDocumentResult {
  const args = parseToolArgs(call) as ReplaceTextDocumentArgs;
  if (typeof args.target !== "object" || args.target === null) {
    throw new Error("target 需要对象参数。");
  }
  const target = args.target as Record<string, unknown>;
  const domain = parseDocumentDomain(target.domain, "target.domain");
  const id = parseNonEmptyString(target.id, "target.id");
  const expectedText = parseNonEmptyString(args.expected_text, "expected_text");
  if (typeof args.replacement_text !== "string") {
    throw new Error("replacement_text 需要字符串。");
  }

  const currentContent =
    domain === "manuscript" ? worktree.readChapter(id) : worktree.readResourceFile(id);
  const firstIndex = currentContent.indexOf(expectedText);
  if (firstIndex < 0) {
    throw new Error("expected_text 不存在于当前内容中；请重新读取正文并提供精确原文。");
  }
  if (currentContent.indexOf(expectedText, firstIndex + expectedText.length) >= 0) {
    throw new Error("expected_text 在当前内容中出现多次；请增加上下文使其唯一。");
  }

  const nextContent =
    currentContent.slice(0, firstIndex) +
    args.replacement_text +
    currentContent.slice(firstIndex + expectedText.length);
  if (domain === "manuscript") {
    worktree.writeChapter(id, nextContent);
  } else {
    worktree.writeResourceFile(id, nextContent);
  }

  return {
    target: { domain, id },
    replacements: 1,
    updated: true,
  };
}

export function executeCreateFolder(
  worktree: WorktreeSession,
  call: ToolCallItem,
): CreateDocumentResult {
  const args = parseToolArgs(call) as CreateNodeArgs;
  const domain = parseDocumentDomain(args.domain, "domain");
  const parentId = parseNonEmptyString(args.parent_id, "parent_id");
  const name = parseNonEmptyString(args.name, "name");
  const index = parseOptionalIndex(args.index);

  if (domain === "manuscript") {
    const created = worktree.createManuscriptFolder(parentId, name, index);
    return {
      domain,
      kind: "folder",
      id: created.nodeId,
      parent_id: parentId,
      name,
      display_path: findCreatedNodePath(worktree, domain, created.nodeId),
    };
  }

  if (index !== undefined) {
    throw new Error("resource 文件夹创建不支持 index。");
  }

  const created = worktree.createResourceFolder(parentId, name);
  return {
    domain,
    kind: "folder",
    id: created.nodeId,
    parent_id: parentId,
    name,
    display_path: findCreatedNodePath(worktree, domain, created.nodeId),
  };
}

export function executeCreateTextDocument(
  worktree: WorktreeSession,
  call: ToolCallItem,
): CreateDocumentResult {
  const args = parseToolArgs(call) as CreateTextDocumentArgs;
  const domain = parseDocumentDomain(args.domain, "domain");
  const parentId = parseNonEmptyString(args.parent_id, "parent_id");
  const name = parseNonEmptyString(args.name, "name");
  const index = parseOptionalIndex(args.index);
  if (typeof args.content !== "string") {
    throw new Error("content 需要字符串。");
  }

  if (domain === "manuscript") {
    const created = worktree.createManuscriptChapter(parentId, name, index);
    worktree.writeChapter(created.nodeId, args.content);
    return {
      domain,
      kind: "chapter",
      id: created.nodeId,
      parent_id: parentId,
      name,
      display_path: findCreatedNodePath(worktree, domain, created.nodeId),
    };
  }

  if (index !== undefined) {
    throw new Error("resource 文件创建不支持 index。");
  }
  const created = worktree.createResourceFile(parentId, name);
  worktree.writeResourceFile(created.nodeId, args.content);
  return {
    domain,
    kind: "file",
    id: created.nodeId,
    parent_id: parentId,
    name,
    display_path: findCreatedNodePath(worktree, domain, created.nodeId),
  };
}
