import type { ManuscriptTreeNode, ResourceTreeNode } from "#domain/worktree";
import type { TreeResolvedDrop } from "#workbench/tree/tree-drag";
import { resolveHoverZone } from "#workbench/tree/tree-drag";
import { findTreeRowDataAtPoint } from "#workbench/tree/tree-row-dom";

import { resolveExternalManuscriptDropTarget } from "../manuscript/manuscript-tree-placement-policy";
import {
  buildManuscriptRenderProjection,
  type ManuscriptRenderProjection,
} from "../manuscript/manuscript-tree-projector";
import type { ManuscriptTreeState } from "../manuscript/state/types";
import { resolveExternalResourceDropTarget } from "../resource-library/resource-tree-placement-policy";
import {
  buildResourceRenderProjection,
  type ResourceRenderProjection,
} from "../resource-library/resource-tree-projector";
import type { ResourceTreeState } from "../resource-library/state/types";
import type { ExplorerDomainRefs } from "./explorer-cross-drag";
import { isPointInsideElement } from "./explorer-cross-drag";

export function resolveDropOntoResource(options: {
  resourceState: ResourceTreeState;
  clientX: number;
  clientY: number;
  resourceRefs: ExplorerDomainRefs;
}): TreeResolvedDrop<string> | null {
  const { resourceState, clientX, clientY, resourceRefs } = options;
  if (resourceState.snapshot === null || resourceState.status !== "ready") {
    return null;
  }
  const overResource =
    isPointInsideElement(clientX, clientY, resourceRefs.shell) ||
    isPointInsideElement(clientX, clientY, resourceRefs.list);
  if (!overResource) {
    return null;
  }
  const projection: ResourceRenderProjection = buildResourceRenderProjection(resourceState);
  const hoveredRow = findTreeRowDataAtPoint<ResourceTreeNode["type"]>(
    clientX,
    clientY,
    resourceRefs.list,
  );
  return resolveExternalResourceDropTarget({
    snapshot: resourceState.snapshot,
    projection,
    hoveredRow,
  });
}

export function resolveDropOntoManuscript(options: {
  manuscriptState: ManuscriptTreeState;
  clientX: number;
  clientY: number;
  manuscriptRefs: ExplorerDomainRefs;
}): TreeResolvedDrop<{
  kind: "into" | "insert";
  parentId: string;
  index?: number;
}> | null {
  const { manuscriptState, clientX, clientY, manuscriptRefs } = options;
  if (manuscriptState.snapshot === null || manuscriptState.status !== "ready") {
    return null;
  }
  const overManuscript =
    isPointInsideElement(clientX, clientY, manuscriptRefs.shell) ||
    isPointInsideElement(clientX, clientY, manuscriptRefs.list);
  if (!overManuscript) {
    return null;
  }
  const projection: ManuscriptRenderProjection = buildManuscriptRenderProjection(manuscriptState);
  const listElement = manuscriptRefs.list;
  const hoveredRow = findTreeRowDataAtPoint<ManuscriptTreeNode["type"]>(
    clientX,
    clientY,
    listElement,
  );
  const resolved = resolveExternalManuscriptDropTarget({
    snapshot: manuscriptState.snapshot,
    projection,
    hoveredRow,
    hoverZone: hoveredRow === null ? null : resolveHoverZone(clientY, hoveredRow.rect),
    listRect: listElement?.getBoundingClientRect() ?? null,
    clientY,
  });
  if (resolved === null) {
    return null;
  }
  if (resolved.target.kind === "into") {
    return {
      preview: resolved.preview,
      target: { kind: "into", parentId: resolved.target.parentId },
    };
  }
  return {
    preview: resolved.preview,
    target: {
      kind: "insert",
      parentId: resolved.target.parentId,
      index: resolved.target.index,
    },
  };
}
