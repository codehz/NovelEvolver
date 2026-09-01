import type { ResourceTreeSnapshot } from "@novelevolver/domain/worktree";

import type { ExplorerVisibleRow } from "../explorer/explorer-tree-flatten";

export function collectResourceDescendantIds(tree: ResourceTreeSnapshot, id: string): string[] {
  const node = tree.nodes[id];
  if (node === undefined || node.type === "file") return [];
  const descendants: string[] = [];
  for (const childId of node.childIds) {
    descendants.push(childId, ...collectResourceDescendantIds(tree, childId));
  }
  return descendants;
}

export function containsResourceNode(
  tree: ResourceTreeSnapshot,
  ancestorId: string,
  targetId: string,
): boolean {
  return (
    ancestorId === targetId || collectResourceDescendantIds(tree, ancestorId).includes(targetId)
  );
}

export function resourceCreateParentId(
  tree: ResourceTreeSnapshot,
  selectedId: string | null,
): string {
  if (selectedId === null) return tree.rootId;
  const node = tree.nodes[selectedId];
  if (node?.type === "folder") return node.id;
  return node?.parentId ?? tree.rootId;
}

export function flattenVisibleResourceRows(
  tree: ResourceTreeSnapshot,
  collapsedIds: Record<string, true> = {},
): ExplorerVisibleRow[] {
  const result: ExplorerVisibleRow[] = [];
  const walk = (parentId: string, depth: number) => {
    const parent = tree.nodes[parentId];
    if (parent?.type !== "folder") return;
    parent.childIds.forEach((id, index) => {
      const node = tree.nodes[id];
      if (node === undefined) return;
      const expanded = node.type === "folder" && collapsedIds[node.id] !== true;
      result.push({
        id: node.id,
        title: node.name,
        type: node.type,
        depth,
        expanded,
        parentId,
        index,
      });
      if (node.type === "folder" && expanded) walk(node.id, depth + 1);
    });
  };
  walk(tree.rootId, 0);
  return result;
}
