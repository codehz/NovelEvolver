import type { ResourceTreeNode, ResourceTreeSnapshot } from "@novelevolver/domain/worktree";

import {
  buildSubtreeEndIndexes,
  sourceSubtreeRange,
  type ManuscriptVisibleRow,
} from "../manuscript/manuscript-tree-flatten";
import {
  resolveHoverZone,
  type ManuscriptHoverZone,
  type ManuscriptResolvedDrop,
} from "../manuscript/manuscript-tree-placement";
import { collectResourceDescendantIds } from "./resource-tree-flatten";

function canMoveIntoParent(
  tree: ResourceTreeSnapshot,
  sourceId: string,
  sourceType: ResourceTreeNode["type"],
  targetParentId: string,
): boolean {
  const target = tree.nodes[targetParentId];
  if (target?.type !== "folder") return false;
  const source = tree.nodes[sourceId];
  if (source === undefined) return false;
  if (source.parentId === targetParentId) return false;
  if (
    sourceType === "folder" &&
    (sourceId === targetParentId ||
      collectResourceDescendantIds(tree, sourceId).includes(targetParentId))
  ) {
    return false;
  }
  return true;
}

function folderHighlight(
  rows: readonly ManuscriptVisibleRow[],
  folderId: string,
): ManuscriptResolvedDrop["preview"] {
  const startIndex = rows.findIndex((row) => row.id === folderId);
  if (startIndex < 0) {
    return { kind: "insert", visualIndex: rows.length, depth: 0 };
  }
  const subtreeEndIndexes = buildSubtreeEndIndexes(rows);
  return {
    kind: "highlight",
    startIndex,
    endIndex: subtreeEndIndexes[startIndex] ?? startIndex,
  };
}

function resolveTargetParentId(
  tree: ResourceTreeSnapshot,
  rows: readonly ManuscriptVisibleRow[],
  hoveredRowIndex: number | null,
  hoverZone: ManuscriptHoverZone | null,
): string | null {
  if (hoveredRowIndex === null) {
    return tree.rootId;
  }
  const hoveredRow = rows[hoveredRowIndex];
  if (hoveredRow === undefined || hoverZone === null) return null;
  const hoveredNode = tree.nodes[hoveredRow.id];
  if (hoveredNode === undefined) return null;
  const subtreeEndIndexes = buildSubtreeEndIndexes(rows);
  const expandedFolderWithChildren =
    hoveredNode.type === "folder" &&
    hoveredRow.expanded &&
    (subtreeEndIndexes[hoveredRowIndex] ?? hoveredRowIndex) > hoveredRowIndex;

  if (hoveredNode.type === "file") {
    return hoveredNode.parentId ?? tree.rootId;
  }
  if (hoverZone === "inside") return hoveredNode.id;
  if (hoverZone === "after" && expandedFolderWithChildren) return hoveredNode.id;
  return hoveredNode.parentId ?? tree.rootId;
}

export function resolveResourceDrop(input: {
  tree: ResourceTreeSnapshot;
  rows: readonly ManuscriptVisibleRow[];
  sourceId: string;
  pointerContentY: number;
  rowHeight: number;
}): ManuscriptResolvedDrop | null {
  const { tree, rows, sourceId, pointerContentY, rowHeight } = input;
  const source = tree.nodes[sourceId];
  if (source === undefined || rowHeight <= 0) return null;
  const range = sourceSubtreeRange(rows, sourceId);

  let hoveredRowIndex: number | null = null;
  let hoverZone: ManuscriptHoverZone | null = null;
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
    const offsetY = pointerContentY - hoveredRowIndex * rowHeight;
    hoverZone = resolveHoverZone(offsetY, rowHeight);
  }

  const parentId = resolveTargetParentId(tree, rows, hoveredRowIndex, hoverZone);
  if (parentId === null) return null;
  if (!canMoveIntoParent(tree, sourceId, source.type, parentId)) return null;

  const preview =
    parentId === tree.rootId
      ? {
          kind: "insert" as const,
          visualIndex: aboveList ? 0 : rows.length,
          depth: 0,
        }
      : folderHighlight(rows, parentId);

  return {
    preview,
    target: { kind: "into", parentId },
    commit: true,
  };
}
