import type { ToolCallItem } from "@codehz/ai";

import type { Change, HistoryEntry } from "#shared/rpc/worktree/index";

import type { AiProjectStructureDomain, WorktreeSession } from "../../worktree/session";
import { parseToolArgs } from "./utils";

export type MoveDocumentResult = {
  domain: "manuscript" | "resource";
  id: string;
  target_parent_id: string;
  moved: true;
};

export type RenameDocumentResult = {
  domain: "manuscript" | "resource";
  id: string;
  name: string;
  renamed: true;
};

export type DeleteDocumentResult = {
  domain: "manuscript" | "resource";
  id: string;
  deleted: true;
};

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

export type GetWorktreeChangesResult = {
  domain: AiProjectStructureDomain;
  revision: number;
  base_tree: string;
  has_changes: boolean;
  warning: string | null;
  manuscript_changes: ChangeDto[];
  resource_changes: ChangeDto[];
};

export type ReadDocumentDiffResult = {
  target: { domain: "manuscript" | "resource"; id: string };
  change_id: string;
  kind: Change["kind"];
  label: string;
  display_path: string;
  original_content: string;
  current_content: string;
};

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

export type ListDocumentHistoryResult = {
  domain: "manuscript" | "resource";
  id: string;
  entries: HistoryEntryDto[];
};

export type ReadHistoryVersionResult = {
  entry_id: string;
  content: string | null;
  before_content: string | null;
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

function parseDocumentTarget(value: unknown): { domain: "manuscript" | "resource"; id: string } {
  if (typeof value !== "object" || value === null) {
    throw new Error("target 需要对象参数。");
  }
  const target = value as Record<string, unknown>;
  return {
    domain: parseDocumentDomain(target.domain, "target.domain"),
    id: parseNonEmptyString(target.id, "target.id"),
  };
}

function parseHistoryLimit(value: unknown): number {
  if (value === undefined) {
    return 50;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error("limit 必须是正整数。");
  }
  return Math.min(value, 200);
}

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

export function executeMoveDocument(
  worktree: WorktreeSession,
  call: ToolCallItem,
): MoveDocumentResult {
  const args = parseToolArgs(call);
  const domain = parseDocumentDomain(args.domain, "domain");
  const id = parseNonEmptyString(args.id, "id");
  const targetParentId = parseNonEmptyString(args.target_parent_id, "target_parent_id");
  const index = parseOptionalIndex(args.index);

  if (domain === "manuscript") {
    worktree.moveManuscriptNode(id, targetParentId, index);
  } else {
    if (index !== undefined) {
      throw new Error("resource 域移动不支持 index。");
    }
    worktree.moveResourceNode(id, targetParentId);
  }

  return {
    domain,
    id,
    target_parent_id: targetParentId,
    moved: true,
  };
}

export function executeRenameDocument(
  worktree: WorktreeSession,
  call: ToolCallItem,
): RenameDocumentResult {
  const args = parseToolArgs(call);
  const domain = parseDocumentDomain(args.domain, "domain");
  const id = parseNonEmptyString(args.id, "id");
  const name = parseNonEmptyString(args.name, "name");

  if (domain === "manuscript") {
    worktree.renameManuscriptNode(id, name);
  } else {
    worktree.renameResourceNode(id, name);
  }

  return {
    domain,
    id,
    name,
    renamed: true,
  };
}

export function executeDeleteDocument(
  worktree: WorktreeSession,
  call: ToolCallItem,
): DeleteDocumentResult {
  const args = parseToolArgs(call);
  const domain = parseDocumentDomain(args.domain, "domain");
  const id = parseNonEmptyString(args.id, "id");

  if (domain === "manuscript") {
    worktree.deleteManuscriptNode(id);
  } else {
    worktree.deleteResourceNode(id);
  }

  return {
    domain,
    id,
    deleted: true,
  };
}

export function executeGetWorktreeChanges(
  worktree: WorktreeSession,
  call: ToolCallItem,
): GetWorktreeChangesResult {
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
}

export function executeReadDocumentDiff(
  worktree: WorktreeSession,
  call: ToolCallItem,
): ReadDocumentDiffResult {
  const args = parseToolArgs(call);
  const target = parseDocumentTarget(args.target);
  const comparison = worktree.readChangeTextComparisonByTarget({
    domain: target.domain,
    entityId: target.id,
  });

  return {
    target: {
      domain: target.domain,
      id: target.id,
    },
    change_id: comparison.changeId,
    kind: comparison.kind,
    label: comparison.label,
    display_path: comparison.displayPath,
    original_content: comparison.originalContent,
    current_content: comparison.currentContent,
  };
}

export function executeListDocumentHistory(
  worktree: WorktreeSession,
  call: ToolCallItem,
): ListDocumentHistoryResult {
  const args = parseToolArgs(call);
  const domain = parseDocumentDomain(args.domain, "domain");
  const id = parseNonEmptyString(args.id, "id");
  const limit = parseHistoryLimit(args.limit);
  const entries = worktree.listFileHistory({ domain, entityId: id }, limit);

  return {
    domain,
    id,
    entries: entries.map(toHistoryEntryDto),
  };
}

export function executeReadHistoryVersion(
  worktree: WorktreeSession,
  call: ToolCallItem,
): ReadHistoryVersionResult {
  const args = parseToolArgs(call);
  const entryId = parseNonEmptyString(args.entry_id, "entry_id");
  const content = worktree.readHistoryEntryContent(entryId);

  return {
    entry_id: entryId,
    content: content.content,
    before_content: content.beforeContent ?? null,
  };
}
