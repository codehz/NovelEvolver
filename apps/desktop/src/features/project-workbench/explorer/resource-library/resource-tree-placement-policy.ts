import type { ResourceTreeNode, ResourceTreeSnapshot } from "@novelevolver/domain/worktree";

import type {
  TreeResolvedDrop,
  TreeRowHoverZone,
} from "#app/features/project-workbench/tree/tree-drag";
import type { TreeRowDomData } from "#app/features/project-workbench/tree/tree-row-dom";
import { TREE_ROW_HEIGHT_PX } from "#app/features/project-workbench/tree/tree-row-motion";

import { isResourceDescendant } from "./resource-tree";
import type { ResourceRenderProjection } from "./resource-tree-projector";

function hasDuplicateNameInTargetParent(
  snapshot: ResourceTreeSnapshot,
  sourceId: string,
  sourceName: string,
  targetParentId: string,
): boolean {
  const targetParent = snapshot.nodes[targetParentId];
  if (targetParent?.type !== "folder") {
    return true;
  }
  return targetParent.childIds.some((childId) => {
    if (childId === sourceId) {
      return false;
    }
    return snapshot.nodes[childId]?.name === sourceName;
  });
}

export function isInvalidDropTarget(
  snapshot: ResourceTreeSnapshot,
  sourceId: string,
  sourceType: ResourceTreeNode["type"],
  targetParentId: string,
): boolean {
  const targetParent = snapshot.nodes[targetParentId];
  if (targetParent?.type !== "folder") {
    return true;
  }
  const source = snapshot.nodes[sourceId];
  if (source === undefined) {
    return true;
  }
  if (targetParentId === sourceId) {
    return true;
  }
  if (sourceType === "folder" && isResourceDescendant(snapshot, sourceId, targetParentId)) {
    return true;
  }
  if (source.parentId === targetParentId) {
    return true;
  }
  if (hasDuplicateNameInTargetParent(snapshot, sourceId, source.name, targetParentId)) {
    return true;
  }
  return false;
}

function resolveDropTargetFromRow(
  snapshot: ResourceTreeSnapshot,
  targetRowId: string,
  targetRowType: ResourceTreeNode["type"],
  sourceId: string,
  sourceType: ResourceTreeNode["type"],
): string | null {
  const targetNode = snapshot.nodes[targetRowId];
  if (targetNode === undefined) {
    return null;
  }
  const candidate = targetRowType === "folder" ? targetRowId : targetNode.parentId;
  if (candidate === null || isInvalidDropTarget(snapshot, sourceId, sourceType, candidate)) {
    return null;
  }
  return candidate;
}

function buildFolderDropPreview(
  snapshot: ResourceTreeSnapshot,
  projection: ResourceRenderProjection,
  targetParentId: string,
): TreeResolvedDrop<string> | null {
  const listHeight = Math.max(projection.items.length, 1) * TREE_ROW_HEIGHT_PX;
  if (targetParentId === snapshot.rootId) {
    return {
      preview: { kind: "highlight", top: 0, height: listHeight },
      target: snapshot.rootId,
    };
  }
  const targetIndex = projection.rowIndexById.get(targetParentId);
  if (targetIndex === undefined) {
    return null;
  }
  const targetItem = projection.items[targetIndex];
  if (targetItem?.type !== "folder") {
    return null;
  }
  const endIndex = projection.subtreeEndIndexes[targetIndex];
  if (endIndex === undefined) {
    return null;
  }
  return {
    preview: {
      kind: "highlight",
      top: targetIndex * TREE_ROW_HEIGHT_PX,
      height: (endIndex - targetIndex + 1) * TREE_ROW_HEIGHT_PX,
    },
    target: targetParentId,
  };
}

export function resolveResourceDropTarget({
  snapshot,
  projection,
  start,
  hoveredRow,
}: {
  snapshot: ResourceTreeSnapshot;
  projection: ResourceRenderProjection;
  start: { rowId: string; rowType: ResourceTreeNode["type"] };
  hoveredRow: TreeRowDomData<ResourceTreeNode["type"]> | null;
  hoverZone: TreeRowHoverZone | null;
  listRect: DOMRect | null;
  clientX: number;
  clientY: number;
}): TreeResolvedDrop<string> | null {
  if (hoveredRow === null) {
    if (isInvalidDropTarget(snapshot, start.rowId, start.rowType, snapshot.rootId)) {
      return null;
    }
    return buildFolderDropPreview(snapshot, projection, snapshot.rootId);
  }
  const targetParentId = resolveDropTargetFromRow(
    snapshot,
    hoveredRow.rowId,
    hoveredRow.rowType,
    start.rowId,
    start.rowType,
  );
  if (targetParentId === null) {
    return null;
  }
  return buildFolderDropPreview(snapshot, projection, targetParentId);
}

/** OS file drop: folder = itself, file = parent, empty area = root. */
export function resolveExternalResourceDropTarget({
  snapshot,
  projection,
  hoveredRow,
}: {
  snapshot: ResourceTreeSnapshot;
  projection: ResourceRenderProjection;
  hoveredRow: TreeRowDomData<ResourceTreeNode["type"]> | null;
}): TreeResolvedDrop<string> | null {
  if (hoveredRow === null) {
    return buildFolderDropPreview(snapshot, projection, snapshot.rootId);
  }
  const targetNode = snapshot.nodes[hoveredRow.rowId];
  if (targetNode === undefined) {
    return buildFolderDropPreview(snapshot, projection, snapshot.rootId);
  }
  const targetParentId =
    hoveredRow.rowType === "folder" ? hoveredRow.rowId : (targetNode.parentId ?? snapshot.rootId);
  if (snapshot.nodes[targetParentId]?.type !== "folder") {
    return buildFolderDropPreview(snapshot, projection, snapshot.rootId);
  }
  return buildFolderDropPreview(snapshot, projection, targetParentId);
}
