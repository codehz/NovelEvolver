import type { ManuscriptNode, ManuscriptOutline } from "@novelevolver/domain/worktree";

import {
  type ExplorerHoverZone,
  type ExplorerMoveTarget,
  type ExplorerDropPreview,
  type ExplorerResolvedDrop,
  resolveHoverZone,
} from "../explorer/explorer-tree-drop";
import {
  buildSubtreeEndIndexes,
  sourceSubtreeRange,
  type ExplorerVisibleRow,
} from "../explorer/explorer-tree-flatten";
import { collectManuscriptDescendantIds, findManuscriptParentId } from "./manuscript-tree-flatten";

function getNodeDepth(outline: ManuscriptOutline, id: string): number {
  if (id === outline.rootId) return -1;
  let depth = 0;
  let current = findManuscriptParentId(outline, id);
  while (current !== null && current !== outline.rootId) {
    depth += 1;
    current = findManuscriptParentId(outline, current);
  }
  return depth;
}

function isDescendant(
  outline: ManuscriptOutline,
  ancestorId: string,
  candidateId: string,
): boolean {
  return collectManuscriptDescendantIds(outline, ancestorId).includes(candidateId);
}

function findChildIndex(outline: ManuscriptOutline, parentId: string, childId: string): number {
  const parent = outline.nodes[parentId];
  if (parent?.type !== "folder") return -1;
  return parent.children.indexOf(childId);
}

function canMoveIntoParent(
  outline: ManuscriptOutline,
  sourceId: string,
  sourceType: ManuscriptNode["type"],
  targetParentId: string,
): boolean {
  const target = outline.nodes[targetParentId];
  if (target?.type !== "folder") return false;
  if (findManuscriptParentId(outline, sourceId) === targetParentId) return false;
  if (
    sourceType === "folder" &&
    (sourceId === targetParentId || isDescendant(outline, sourceId, targetParentId))
  ) {
    return false;
  }
  return true;
}

export function isValidManuscriptMoveTarget(
  outline: ManuscriptOutline,
  sourceId: string,
  sourceType: ManuscriptNode["type"],
  target: ExplorerMoveTarget,
): boolean {
  if (target.kind === "into") {
    return canMoveIntoParent(outline, sourceId, sourceType, target.parentId);
  }
  const targetParent = outline.nodes[target.parentId];
  if (targetParent?.type !== "folder") return false;
  if (
    sourceType === "folder" &&
    (sourceId === target.parentId || isDescendant(outline, sourceId, target.parentId))
  ) {
    return false;
  }
  if (target.index < 0 || target.index > targetParent.children.length) return false;
  const sourceParentId = findManuscriptParentId(outline, sourceId);
  if (sourceParentId === null) return false;
  if (sourceParentId !== target.parentId) return true;
  const sourceIndex = findChildIndex(outline, sourceParentId, sourceId);
  if (sourceIndex < 0) return false;
  return target.index !== sourceIndex && target.index !== sourceIndex + 1;
}

function resolveManuscriptDropCore(
  outline: ManuscriptOutline,
  rows: readonly ExplorerVisibleRow[],
  hoveredRowIndex: number | null,
  hoverZone: ExplorerHoverZone | null,
  offsetY: number,
  rowHeight: number,
  aboveList: boolean,
): { preview: ExplorerDropPreview; target: ExplorerMoveTarget } | null {
  const rootNode = outline.nodes[outline.rootId];
  if (rootNode?.type !== "folder") return null;

  const subtreeEndIndexes = buildSubtreeEndIndexes(rows);
  const getInsertDepth = (parentId: string) => getNodeDepth(outline, parentId) + 1;

  const resolveInsert = (rowId: string, visualIndex: number, placeAfter: boolean) => {
    const parentId = findManuscriptParentId(outline, rowId);
    if (parentId === null) return null;
    const childIndex = findChildIndex(outline, parentId, rowId);
    if (childIndex < 0) return null;
    return {
      preview: {
        kind: "insert" as const,
        visualIndex,
        depth: getInsertDepth(parentId),
      },
      target: {
        kind: "insert" as const,
        parentId,
        index: childIndex + (placeAfter ? 1 : 0),
      },
    };
  };

  const isExpandedFolderWithVisibleChildren = (rowIndex: number, folderId: string) => {
    const item = rows[rowIndex];
    return (
      item?.id === folderId &&
      item.type === "folder" &&
      item.expanded &&
      (subtreeEndIndexes[rowIndex] ?? rowIndex) > rowIndex
    );
  };

  const resolveInto = (rowIndex: number, folderId: string) => ({
    preview: {
      kind: "highlight" as const,
      startIndex: rowIndex,
      endIndex: subtreeEndIndexes[rowIndex] ?? rowIndex,
    },
    target: { kind: "into" as const, parentId: folderId },
  });

  if (hoveredRowIndex === null) {
    return {
      preview: {
        kind: "insert",
        visualIndex: aboveList ? 0 : rows.length,
        depth: 0,
      },
      target: {
        kind: "insert",
        parentId: outline.rootId,
        index: aboveList ? 0 : rootNode.children.length,
      },
    };
  }

  const hoveredRow = rows[hoveredRowIndex];
  if (hoveredRow === undefined || hoverZone === null) return null;
  const hoveredNode = outline.nodes[hoveredRow.id];
  if (hoveredNode === undefined) return null;

  const effectiveZone =
    hoveredNode.type === "chapter" && hoverZone === "inside"
      ? offsetY < rowHeight / 2
        ? "before"
        : "after"
      : hoverZone;

  if (effectiveZone === "inside") {
    return hoveredNode.type !== "folder" ? null : resolveInto(hoveredRowIndex, hoveredNode.id);
  }

  if (effectiveZone === "before") {
    return resolveInsert(hoveredNode.id, hoveredRowIndex, false);
  }

  if (
    hoveredNode.type === "folder" &&
    isExpandedFolderWithVisibleChildren(hoveredRowIndex, hoveredNode.id)
  ) {
    return {
      preview: {
        kind: "insert",
        visualIndex: hoveredRowIndex + 1,
        depth: getInsertDepth(hoveredNode.id),
      },
      target: {
        kind: "insert",
        parentId: hoveredNode.id,
        index: 0,
      },
    };
  }

  const afterVisualIndex =
    hoveredNode.type === "folder"
      ? (subtreeEndIndexes[hoveredRowIndex] ?? hoveredRowIndex) + 1
      : hoveredRowIndex + 1;
  return resolveInsert(hoveredNode.id, afterVisualIndex, true);
}

export function resolveManuscriptDrop(input: {
  outline: ManuscriptOutline;
  rows: readonly ExplorerVisibleRow[];
  sourceId: string;
  sourceType: ManuscriptNode["type"];
  pointerContentY: number;
  rowHeight: number;
}): ExplorerResolvedDrop | null {
  const { outline, rows, sourceId, sourceType, pointerContentY, rowHeight } = input;
  if (rowHeight <= 0) return null;
  const range = sourceSubtreeRange(rows, sourceId);

  let hoveredRowIndex: number | null = null;
  let hoverZone: ExplorerHoverZone | null = null;
  let offsetY = 0;
  let aboveList = false;

  if (pointerContentY < 0) {
    aboveList = true;
  } else if (rows.length === 0 || pointerContentY >= rows.length * rowHeight) {
    aboveList = false;
  } else {
    hoveredRowIndex = Math.min(rows.length - 1, Math.floor(pointerContentY / rowHeight));
    if (
      range !== null &&
      hoveredRowIndex >= range.start &&
      hoveredRowIndex < range.start + range.count
    ) {
      return null;
    }
    offsetY = pointerContentY - hoveredRowIndex * rowHeight;
    hoverZone = resolveHoverZone(offsetY, rowHeight);
  }

  const resolved = resolveManuscriptDropCore(
    outline,
    rows,
    hoveredRowIndex,
    hoverZone,
    offsetY,
    rowHeight,
    aboveList,
  );
  if (resolved === null) return null;
  if (isValidManuscriptMoveTarget(outline, sourceId, sourceType, resolved.target)) {
    return { ...resolved, commit: true };
  }
  return null;
}
