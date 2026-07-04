import type { ManuscriptNode, ManuscriptOutline } from "#shared/rpc/projects-rpc";

import type { TreeResolvedDrop, TreeRowHoverZone } from "../tree/tree-drag";
import type { TreeRowDomData } from "../tree/tree-row-dom";
import { TREE_DROP_INDICATOR_HEIGHT_PX, TREE_ROW_HEIGHT_PX } from "../tree/tree-row-motion";
import {
  findManuscriptChildIndex,
  findManuscriptParentId,
  getManuscriptNodeDepth,
  isManuscriptDescendant,
} from "./manuscript-tree";
import type { ManuscriptRenderProjection } from "./manuscript-tree-projector";
import type { ManuscriptMoveTarget } from "./state/types";

function canMoveIntoParent(
  outline: ManuscriptOutline | null,
  sourceId: string,
  sourceType: ManuscriptNode["type"],
  targetParentId: string,
): boolean {
  if (outline === null) {
    return false;
  }
  const target = outline.nodes[targetParentId];
  if (target?.type !== "folder") {
    return false;
  }
  const sourceParentId = findManuscriptParentId(outline, sourceId);
  if (sourceParentId === targetParentId) {
    return false;
  }
  if (
    sourceType === "folder" &&
    (sourceId === targetParentId || isManuscriptDescendant(outline, sourceId, targetParentId))
  ) {
    return false;
  }
  return true;
}

export function isValidManuscriptMoveTarget(
  outline: ManuscriptOutline | null,
  sourceId: string,
  sourceType: ManuscriptNode["type"],
  target: ManuscriptMoveTarget,
): boolean {
  if (outline === null) {
    return false;
  }
  if (target.kind === "into") {
    return canMoveIntoParent(outline, sourceId, sourceType, target.parentId);
  }
  const targetParent = outline.nodes[target.parentId];
  if (targetParent?.type !== "folder") {
    return false;
  }
  if (
    sourceType === "folder" &&
    (sourceId === target.parentId || isManuscriptDescendant(outline, sourceId, target.parentId))
  ) {
    return false;
  }
  if (target.index < 0 || target.index > targetParent.children.length) {
    return false;
  }
  const sourceParentId = findManuscriptParentId(outline, sourceId);
  if (sourceParentId === null) {
    return false;
  }
  if (sourceParentId !== target.parentId) {
    return true;
  }
  const sourceIndex = findManuscriptChildIndex(outline, sourceParentId, sourceId);
  if (sourceIndex < 0) {
    return false;
  }
  return target.index !== sourceIndex && target.index !== sourceIndex + 1;
}

export function resolveManuscriptDropTarget({
  outline,
  projection,
  hoveredRow,
  hoverZone,
  listRect,
  clientY,
}: {
  outline: ManuscriptOutline;
  projection: ManuscriptRenderProjection;
  start: { rowId: string; rowType: ManuscriptNode["type"] };
  hoveredRow: TreeRowDomData<ManuscriptNode["type"]> | null;
  hoverZone: TreeRowHoverZone | null;
  listRect: DOMRect | null;
  clientX: number;
  clientY: number;
}): TreeResolvedDrop<ManuscriptMoveTarget> | null {
  const rootNode = outline.nodes[outline.rootId];
  if (rootNode?.type !== "folder") {
    return null;
  }

  const getInsertDepth = (parentId: string) => getManuscriptNodeDepth(outline, parentId) + 1;

  const createInsertPreview = (visualIndex: number, depth: number) => ({
    kind: "insert" as const,
    depth,
    top: visualIndex * TREE_ROW_HEIGHT_PX - TREE_DROP_INDICATOR_HEIGHT_PX / 2,
    height: TREE_DROP_INDICATOR_HEIGHT_PX,
  });

  const resolveInsert = (rowId: string, visualIndex: number, placeAfter: boolean) => {
    const parentId = findManuscriptParentId(outline, rowId);
    if (parentId === null) {
      return null;
    }
    const childIndex = findManuscriptChildIndex(outline, parentId, rowId);
    if (childIndex < 0) {
      return null;
    }
    return {
      preview: createInsertPreview(visualIndex, getInsertDepth(parentId)),
      target: {
        kind: "insert" as const,
        parentId,
        index: childIndex + (placeAfter ? 1 : 0),
      },
    };
  };

  const isExpandedFolderWithVisibleChildren = (rowIndex: number, folderId: string) => {
    const item = projection.items[rowIndex];
    return (
      item?.id === folderId &&
      item.type === "folder" &&
      item.expanded &&
      (projection.subtreeEndIndexes[rowIndex] ?? rowIndex) > rowIndex
    );
  };

  const resolveInto = (rowIndex: number, folderId: string) => {
    const visualIndex = isExpandedFolderWithVisibleChildren(rowIndex, folderId)
      ? (projection.subtreeEndIndexes[rowIndex] ?? rowIndex) + 1
      : rowIndex + 1;
    return {
      preview: createInsertPreview(visualIndex, getInsertDepth(folderId)),
      target: { kind: "into" as const, parentId: folderId },
    };
  };

  if (hoveredRow === null) {
    const rootIndex = listRect !== null && clientY <= listRect.top ? 0 : projection.items.length;
    return {
      preview: createInsertPreview(rootIndex, 0),
      target: {
        kind: "insert",
        parentId: outline.rootId,
        index: rootIndex === 0 ? 0 : rootNode.children.length,
      },
    };
  }

  const hoveredNode = outline.nodes[hoveredRow.rowId];
  if (hoveredNode === undefined || hoverZone === null) {
    return null;
  }
  const hoveredRowIndex = projection.rowIndexById.get(hoveredNode.id) ?? hoveredRow.rowIndex;
  const effectiveZone =
    hoveredNode.type === "chapter" && hoverZone === "inside"
      ? clientY < hoveredRow.rect.top + hoveredRow.rect.height / 2
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
      preview: createInsertPreview(hoveredRowIndex + 1, getInsertDepth(hoveredNode.id)),
      target: {
        kind: "insert",
        parentId: hoveredNode.id,
        index: 0,
      },
    };
  }

  const afterVisualIndex =
    hoveredNode.type === "folder"
      ? (projection.subtreeEndIndexes[hoveredRowIndex] ?? hoveredRowIndex) + 1
      : hoveredRowIndex + 1;
  return resolveInsert(hoveredNode.id, afterVisualIndex, true);
}
