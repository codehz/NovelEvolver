import type { ManuscriptNode, ManuscriptOutline } from "@novelevolver/domain/worktree";

import {
  buildSubtreeEndIndexes,
  collectManuscriptDescendantIds,
  findManuscriptParentId,
  packRowsExcludingSource,
  type ManuscriptVisibleRow,
} from "./manuscript-tree-flatten";

export type ManuscriptHoverZone = "before" | "inside" | "after";

export type ManuscriptMoveTarget =
  | { kind: "into"; parentId: string }
  | { kind: "insert"; parentId: string; index: number };

export type ManuscriptDropPreview =
  | { kind: "insert"; visualIndex: number; depth: number }
  | { kind: "into"; folderId: string; visualIndex: number; depth: number };

export type ManuscriptResolvedDrop = {
  preview: ManuscriptDropPreview;
  target: ManuscriptMoveTarget;
  commit: boolean;
};

export function resolveHoverZone(offsetY: number, rowHeight: number): ManuscriptHoverZone {
  if (offsetY < rowHeight * 0.25) return "before";
  if (offsetY > rowHeight * 0.75) return "after";
  return "inside";
}

export function dropKey(drop: ManuscriptResolvedDrop | null): string {
  if (drop === null) return "";
  const prefix = drop.commit ? "move" : "restore";
  if (drop.target.kind === "into") return `${prefix}:into:${drop.target.parentId}`;
  return `${prefix}:insert:${drop.target.parentId}:${drop.target.index}`;
}

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
  target: ManuscriptMoveTarget,
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

export function isManuscriptRestoreTarget(
  outline: ManuscriptOutline,
  sourceId: string,
  target: ManuscriptMoveTarget,
): boolean {
  if (target.kind !== "insert") return false;
  const sourceParentId = findManuscriptParentId(outline, sourceId);
  if (sourceParentId === null || sourceParentId !== target.parentId) return false;
  const sourceIndex = findChildIndex(outline, sourceParentId, sourceId);
  if (sourceIndex < 0) return false;
  return target.index === sourceIndex || target.index === sourceIndex + 1;
}

function resolveManuscriptDropCore(
  outline: ManuscriptOutline,
  rows: readonly ManuscriptVisibleRow[],
  hoveredRowIndex: number | null,
  hoverZone: ManuscriptHoverZone | null,
  offsetY: number,
  rowHeight: number,
  aboveList: boolean,
): { preview: ManuscriptDropPreview; target: ManuscriptMoveTarget } | null {
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

  const resolveInto = (rowIndex: number, folderId: string) => {
    const visualIndex = isExpandedFolderWithVisibleChildren(rowIndex, folderId)
      ? (subtreeEndIndexes[rowIndex] ?? rowIndex) + 1
      : rowIndex + 1;
    return {
      preview: {
        kind: "into" as const,
        folderId,
        visualIndex,
        depth: getInsertDepth(folderId),
      },
      target: { kind: "into" as const, parentId: folderId },
    };
  };

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
  rows: readonly ManuscriptVisibleRow[];
  sourceId: string;
  sourceType: ManuscriptNode["type"];
  pointerContentY: number;
  rowHeight: number;
}): ManuscriptResolvedDrop | null {
  const { outline, rows, sourceId, sourceType, pointerContentY, rowHeight } = input;
  if (rowHeight <= 0) return null;
  const packed = packRowsExcludingSource(rows, sourceId);

  let hoveredRowIndex: number | null = null;
  let hoverZone: ManuscriptHoverZone | null = null;
  let offsetY = 0;
  let aboveList = false;

  if (pointerContentY < 0) {
    aboveList = true;
  } else if (packed.length === 0 || pointerContentY >= packed.length * rowHeight) {
    aboveList = false;
  } else {
    hoveredRowIndex = Math.min(packed.length - 1, Math.floor(pointerContentY / rowHeight));
    offsetY = pointerContentY - hoveredRowIndex * rowHeight;
    hoverZone = resolveHoverZone(offsetY, rowHeight);
  }

  const resolved = resolveManuscriptDropCore(
    outline,
    packed,
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
  if (isManuscriptRestoreTarget(outline, sourceId, resolved.target)) {
    return { ...resolved, commit: false };
  }
  return null;
}
