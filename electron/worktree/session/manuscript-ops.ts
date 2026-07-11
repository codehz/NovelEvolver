import type { WorktreeNodeIdResult } from "#shared/rpc/worktree/index";

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
