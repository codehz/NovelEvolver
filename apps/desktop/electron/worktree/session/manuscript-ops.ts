import { resourceBaseName, resourceParentPath } from "#domain/resource-library-path";
import type {
  ExternalImportEntry,
  ExternalImportSkip,
  ManuscriptImportCreated,
  ManuscriptImportResult,
  WorktreeNodeIdResult,
} from "#domain/worktree";
import { EXTERNAL_IMPORT_MAX_FILE_BYTES } from "#domain/worktree";

import type { JournalOperationCapture } from "../journal/journal-types";
import {
  clampChildIndex,
  MANUSCRIPT_ROOT_ID,
  normalizeManuscriptTitle,
} from "../manuscript/outline";
import {
  collectManuscriptSubtreeIds,
  createUniqueManuscriptId,
  isManuscriptDescendant,
  requireManuscriptFolder,
  requireManuscriptJournalEntry,
  requireManuscriptNode,
} from "./helpers";
import { persistAndEmit } from "./persistence";
import { rebuildCurrentManuscriptFromTree } from "./rebuild";
import { deleteManuscriptNodeFromCurrent } from "./revert";
import type { WorktreeSessionState } from "./state";

const CHAPTER_TITLE_STRIP_EXTENSIONS = [".markdown", ".md", ".txt"] as const;

function stripChapterTitleExtension(basename: string): string {
  const lower = basename.toLowerCase();
  for (const ext of CHAPTER_TITLE_STRIP_EXTENSIONS) {
    if (lower.endsWith(ext) && basename.length > ext.length) {
      return basename.slice(0, -ext.length);
    }
  }
  return basename;
}

function tryNormalizeImportTitle(
  relativePath: string,
  kind: "folder" | "file",
): { title: string } | { skip: ExternalImportSkip } {
  if (relativePath === "") {
    return {
      skip: {
        relativePath,
        reason: "empty-path",
        message: "路径不能为空",
      },
    };
  }
  const basename = resourceBaseName(relativePath);
  const rawTitle = kind === "file" ? stripChapterTitleExtension(basename) : basename;
  try {
    return { title: normalizeManuscriptTitle(rawTitle) };
  } catch (error) {
    return {
      skip: {
        relativePath,
        reason: "invalid-name",
        message: error instanceof Error ? error.message : "名称无效",
      },
    };
  }
}

export function createManuscriptFolder(
  state: WorktreeSessionState,
  parentId: string,
  title: string,
  index?: number,
): WorktreeNodeIdResult {
  const parent = requireManuscriptFolder(state, parentId);
  const nodeId = createUniqueManuscriptId(state);
  const normalizedTitle = normalizeManuscriptTitle(title);
  parent.childIds.splice(clampChildIndex(index, parent.childIds.length), 0, nodeId);
  state.manuscriptTree.nodes[nodeId] = {
    id: nodeId,
    type: "folder",
    title: normalizedTitle,
    parentId,
    childIds: [],
  };
  rebuildCurrentManuscriptFromTree(state);
  const entry = requireManuscriptJournalEntry(state, nodeId);
  persistAndEmit(state, false, {
    source: "structure-edit",
    title: "创建文件夹",
    groupKey: null,
    operations: [
      {
        kind: "create",
        domain: "manuscript",
        entityId: nodeId,
        entityKind: "folder",
        label: entry.title,
        displayPath: entry.displayPath,
      },
    ],
  });
  return { nodeId };
}

export function createManuscriptChapter(
  state: WorktreeSessionState,
  parentId: string,
  title: string,
  index?: number,
): WorktreeNodeIdResult {
  const parent = requireManuscriptFolder(state, parentId);
  const nodeId = createUniqueManuscriptId(state);
  const normalizedTitle = normalizeManuscriptTitle(title);
  parent.childIds.splice(clampChildIndex(index, parent.childIds.length), 0, nodeId);
  state.manuscriptTree.nodes[nodeId] = {
    id: nodeId,
    type: "chapter",
    title: normalizedTitle,
    parentId,
    childIds: [],
  };
  rebuildCurrentManuscriptFromTree(state, new Map([[nodeId, ""]]));
  const entry = requireManuscriptJournalEntry(state, nodeId);
  persistAndEmit(state, false, {
    source: "structure-edit",
    title: "创建章节",
    groupKey: null,
    operations: [
      {
        kind: "create",
        domain: "manuscript",
        entityId: nodeId,
        entityKind: "chapter",
        label: entry.title,
        displayPath: entry.displayPath,
        afterContent: entry.content,
      },
    ],
  });
  return { nodeId };
}

export function renameManuscriptNode(state: WorktreeSessionState, id: string, title: string): void {
  const node = requireManuscriptNode(state, id);
  const previous = requireManuscriptJournalEntry(state, id);
  const normalizedTitle = normalizeManuscriptTitle(title);
  if (node.title === normalizedTitle) {
    return;
  }
  node.title = normalizedTitle;
  rebuildCurrentManuscriptFromTree(state);
  const current = requireManuscriptJournalEntry(state, id);
  persistAndEmit(state, false, {
    source: "structure-edit",
    title: "重命名",
    groupKey: null,
    operations: [
      {
        kind: "rename",
        domain: "manuscript",
        entityId: id,
        entityKind: current.type === "chapter" ? "chapter" : "folder",
        label: current.title,
        displayPath: current.displayPath,
        previousLabel: previous.title,
        previousPath: previous.displayPath,
        beforeContent: previous.type === "chapter" ? previous.content : null,
        afterContent: current.type === "chapter" ? current.content : null,
      },
    ],
  });
}

export function moveManuscriptNode(
  state: WorktreeSessionState,
  id: string,
  targetParentId: string,
  index?: number,
): void {
  if (id === MANUSCRIPT_ROOT_ID) {
    throw new Error("Cannot move the manuscript root.");
  }
  const node = requireManuscriptNode(state, id);
  if (targetParentId === id || isManuscriptDescendant(state, id, targetParentId)) {
    throw new Error("Cannot move a manuscript node into itself or its descendants.");
  }
  const previous = requireManuscriptJournalEntry(state, id);
  const sourceParent = requireManuscriptFolder(state, node.parentId ?? "");
  const targetParent = requireManuscriptFolder(state, targetParentId);
  const previousIndex = sourceParent.childIds.indexOf(id);
  if (previousIndex === -1) {
    throw new Error(`Manuscript node is missing from parent: ${id}`);
  }
  sourceParent.childIds.splice(previousIndex, 1);
  const insertionIndex =
    sourceParent.id === targetParent.id && index !== undefined && index > previousIndex
      ? clampChildIndex(index - 1, targetParent.childIds.length)
      : clampChildIndex(index, targetParent.childIds.length);
  targetParent.childIds.splice(insertionIndex, 0, id);
  node.parentId = targetParent.id;
  rebuildCurrentManuscriptFromTree(state);
  const current = requireManuscriptJournalEntry(state, id);
  persistAndEmit(state, false, {
    source: "structure-edit",
    title: sourceParent.id === targetParent.id ? "调整顺序" : "移动",
    groupKey: null,
    operations: [
      {
        kind: sourceParent.id === targetParent.id ? "reorder" : "move",
        domain: "manuscript",
        entityId: id,
        entityKind: current.type === "chapter" ? "chapter" : "folder",
        label: current.title,
        displayPath: current.displayPath,
        previousPath: previous.displayPath,
        beforeContent: previous.type === "chapter" ? previous.content : null,
        afterContent: current.type === "chapter" ? current.content : null,
      },
    ],
  });
}

export function deleteManuscriptNode(state: WorktreeSessionState, id: string): void {
  const operations = collectManuscriptSubtreeIds(state, id).map((subtreeId) => {
    const entry = requireManuscriptJournalEntry(state, subtreeId);
    return {
      kind: "delete" as const,
      domain: "manuscript" as const,
      entityId: subtreeId,
      entityKind: entry.type === "chapter" ? ("chapter" as const) : ("folder" as const),
      label: entry.title,
      displayPath: entry.displayPath,
      beforeContent: entry.type === "chapter" ? entry.content : null,
    };
  });
  deleteManuscriptNodeFromCurrent(state, id);
  persistAndEmit(state, false, {
    source: "structure-edit",
    title: "删除",
    groupKey: null,
    operations,
  });
}

export function readChapter(state: WorktreeSessionState, id: string): string {
  const node = requireManuscriptNode(state, id);
  if (node.type !== "chapter") {
    throw new Error(`Manuscript node is not a chapter: ${id}`);
  }
  return state.currentManuscript.entries.get(id)?.content ?? "";
}

export function writeChapter(state: WorktreeSessionState, id: string, content: string): void {
  const node = requireManuscriptNode(state, id);
  if (node.type !== "chapter") {
    throw new Error(`Manuscript node is not a chapter: ${id}`);
  }
  const entry = state.currentManuscript.entries.get(id);
  if (entry === undefined) {
    throw new Error(`Manuscript chapter is missing: ${id}`);
  }
  const beforeContent = entry.content;
  if (beforeContent === content) {
    return;
  }
  entry.content = content;
  persistAndEmit(state, false, {
    source: "autosave",
    title: "自动保存",
    groupKey: `autosave:manuscript:${id}`,
    operations: [
      {
        kind: "content",
        domain: "manuscript",
        entityId: id,
        entityKind: "chapter",
        label: entry.title,
        displayPath: entry.displayPath,
        beforeContent,
        afterContent: content,
      },
    ],
  });
}

/**
 * Batch-import folders and UTF-8 text files as manuscript folders/chapters.
 * Always creates new nodes (duplicate titles allowed). Single journal revision.
 */
export function importManuscriptEntries(
  state: WorktreeSessionState,
  targetParentId: string,
  entries: readonly ExternalImportEntry[],
  index?: number,
): ManuscriptImportResult {
  requireManuscriptFolder(state, targetParentId);

  const deduped = new Map<string, ExternalImportEntry>();
  for (const entry of entries) {
    deduped.set(entry.relativePath, entry);
  }

  const ordered = [...deduped.values()].sort((left, right) => {
    const leftDepth = left.relativePath === "" ? 0 : left.relativePath.split("/").length;
    const rightDepth = right.relativePath === "" ? 0 : right.relativePath.split("/").length;
    if (leftDepth !== rightDepth) {
      return leftDepth - rightDepth;
    }
    return left.relativePath.localeCompare(right.relativePath);
  });

  const pathToNodeId = new Map<string, string>();
  const created: ManuscriptImportCreated[] = [];
  const skipped: ExternalImportSkip[] = [];
  const contentOverrides = new Map<string, string>();
  let nextTopLevelIndex = clampChildIndex(
    index,
    requireManuscriptFolder(state, targetParentId).childIds.length,
  );

  for (const entry of ordered) {
    const normalized = tryNormalizeImportTitle(entry.relativePath, entry.kind);
    if ("skip" in normalized) {
      skipped.push(normalized.skip);
      continue;
    }
    const { title } = normalized;
    const parentRelative = resourceParentPath(entry.relativePath);
    const isTopLevel = parentRelative === "";
    const parentId = isTopLevel ? targetParentId : (pathToNodeId.get(parentRelative) ?? null);
    if (parentId === null) {
      skipped.push({
        relativePath: entry.relativePath,
        reason: "missing-parent",
        message: `缺少父目录: ${parentRelative}`,
      });
      continue;
    }

    if (entry.kind === "folder") {
      const nodeId = createUniqueManuscriptId(state);
      const parent = requireManuscriptFolder(state, parentId);
      if (isTopLevel) {
        parent.childIds.splice(nextTopLevelIndex, 0, nodeId);
        nextTopLevelIndex += 1;
      } else {
        parent.childIds.push(nodeId);
      }
      state.manuscriptTree.nodes[nodeId] = {
        id: nodeId,
        type: "folder",
        title,
        parentId,
        childIds: [],
      };
      pathToNodeId.set(entry.relativePath, nodeId);
      created.push({ nodeId, relativePath: entry.relativePath, kind: "folder" });
      continue;
    }

    if (Buffer.byteLength(entry.content, "utf8") >= EXTERNAL_IMPORT_MAX_FILE_BYTES) {
      skipped.push({
        relativePath: entry.relativePath,
        reason: "too-large",
        message: `文件超过 ${EXTERNAL_IMPORT_MAX_FILE_BYTES} 字节`,
      });
      continue;
    }

    const nodeId = createUniqueManuscriptId(state);
    const parent = requireManuscriptFolder(state, parentId);
    if (isTopLevel) {
      parent.childIds.splice(nextTopLevelIndex, 0, nodeId);
      nextTopLevelIndex += 1;
    } else {
      parent.childIds.push(nodeId);
    }
    state.manuscriptTree.nodes[nodeId] = {
      id: nodeId,
      type: "chapter",
      title,
      parentId,
      childIds: [],
    };
    pathToNodeId.set(entry.relativePath, nodeId);
    contentOverrides.set(nodeId, entry.content);
    created.push({ nodeId, relativePath: entry.relativePath, kind: "chapter" });
  }

  if (created.length === 0) {
    return { created, skipped };
  }

  rebuildCurrentManuscriptFromTree(state, contentOverrides);

  const operations: JournalOperationCapture[] = [];
  for (const item of created) {
    const journalEntry = requireManuscriptJournalEntry(state, item.nodeId);
    operations.push({
      kind: "create",
      domain: "manuscript",
      entityId: item.nodeId,
      entityKind: item.kind === "chapter" ? "chapter" : "folder",
      label: journalEntry.title,
      displayPath: journalEntry.displayPath,
      afterContent: item.kind === "chapter" ? journalEntry.content : null,
    });
  }

  persistAndEmit(state, false, {
    source: "import",
    title: created.length === 1 ? "导入文件" : `导入 ${created.length} 项`,
    groupKey: null,
    operations,
  });

  return { created, skipped };
}
