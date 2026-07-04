import { resourceBaseName, resourceParentPath } from "#shared/resource-library-path";
import type { ResourceTreeSnapshot } from "#shared/rpc/projects-rpc";

import type { TreeResolvedDrop, TreeRowHoverZone } from "../tree/tree-drag";
import type { TreeRowDomData } from "../tree/tree-row-dom";
import { TREE_ROW_HEIGHT_PX } from "../tree/tree-row-motion";
import type { ResourceRenderProjection } from "./resource-tree-projector";

export function moveDestinationPath(sourcePath: string, targetPath: string): string {
  const sourceName = resourceBaseName(sourcePath);
  return targetPath === "" ? sourceName : `${targetPath}/${sourceName}`;
}

export function isInvalidDropTarget(
  snapshot: ResourceTreeSnapshot,
  sourcePath: string,
  sourceType: "file" | "folder",
  targetPath: string,
): boolean {
  if (snapshot.nodes[targetPath]?.type !== "folder") {
    return true;
  }
  if (targetPath === sourcePath) {
    return true;
  }
  if (sourceType === "folder" && targetPath.startsWith(`${sourcePath}/`)) {
    return true;
  }
  const sourceParent = resourceParentPath(sourcePath);
  if (targetPath === sourceParent) {
    return true;
  }
  if (snapshot.nodes[moveDestinationPath(sourcePath, targetPath)] !== undefined) {
    return true;
  }
  return false;
}

function resolveDropTargetFromRow(
  snapshot: ResourceTreeSnapshot,
  targetRowPath: string,
  targetRowType: "file" | "folder",
  sourcePath: string,
  sourceType: "file" | "folder",
): string | null {
  const candidate = targetRowType === "folder" ? targetRowPath : resourceParentPath(targetRowPath);
  if (isInvalidDropTarget(snapshot, sourcePath, sourceType, candidate)) {
    return null;
  }
  return candidate;
}

export function resolveResourceDropTarget({
  snapshot,
  projection,
  start,
  hoveredRow,
}: {
  snapshot: ResourceTreeSnapshot;
  projection: ResourceRenderProjection;
  start: { rowId: string; rowType: "file" | "folder" };
  hoveredRow: TreeRowDomData<"file" | "folder"> | null;
  hoverZone: TreeRowHoverZone | null;
  listRect: DOMRect | null;
  clientX: number;
  clientY: number;
}): TreeResolvedDrop<string> | null {
  const listHeight = projection.items.length * TREE_ROW_HEIGHT_PX;
  if (hoveredRow === null) {
    if (isInvalidDropTarget(snapshot, start.rowId, start.rowType, "")) {
      return null;
    }
    return {
      preview: { kind: "highlight", top: 0, height: listHeight },
      target: "",
    };
  }
  const targetPath = resolveDropTargetFromRow(
    snapshot,
    hoveredRow.rowId,
    hoveredRow.rowType,
    start.rowId,
    start.rowType,
  );
  if (targetPath === null) {
    return null;
  }
  if (targetPath === "") {
    return {
      preview: { kind: "highlight", top: 0, height: listHeight },
      target: "",
    };
  }
  const targetIndex = projection.rowIndexById.get(targetPath);
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
    target: targetPath,
  };
}
