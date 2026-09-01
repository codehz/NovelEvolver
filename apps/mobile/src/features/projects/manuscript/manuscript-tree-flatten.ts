import type { ManuscriptOutline } from "@novelevolver/domain/worktree";

import type { ExplorerVisibleRow } from "../explorer/explorer-tree-flatten";

export function findManuscriptParentId(outline: ManuscriptOutline, id: string): string | null {
  for (const node of Object.values(outline.nodes)) {
    if (node.type === "folder" && node.children.includes(id)) return node.id;
  }
  return null;
}

export function collectManuscriptDescendantIds(outline: ManuscriptOutline, id: string): string[] {
  const node = outline.nodes[id];
  if (node === undefined || node.type === "chapter") return [];
  const descendants: string[] = [];
  for (const childId of node.children) {
    descendants.push(childId, ...collectManuscriptDescendantIds(outline, childId));
  }
  return descendants;
}

export function containsManuscriptNode(
  outline: ManuscriptOutline,
  ancestorId: string,
  targetId: string,
): boolean {
  return (
    ancestorId === targetId ||
    collectManuscriptDescendantIds(outline, ancestorId).includes(targetId)
  );
}

export function flattenVisibleManuscriptRows(
  outline: ManuscriptOutline,
  collapsedIds: Record<string, true> = {},
): ExplorerVisibleRow[] {
  const result: ExplorerVisibleRow[] = [];
  const walk = (parentId: string, depth: number) => {
    const parent = outline.nodes[parentId];
    if (parent?.type !== "folder") return;
    parent.children.forEach((id, index) => {
      const node = outline.nodes[id];
      if (node === undefined) return;
      const expanded = node.type === "folder" && collapsedIds[node.id] !== true;
      result.push({
        id: node.id,
        title: node.title,
        type: node.type,
        depth,
        expanded,
        parentId,
        index,
      });
      if (node.type === "folder" && expanded) walk(node.id, depth + 1);
    });
  };
  walk(outline.rootId, 0);
  return result;
}
