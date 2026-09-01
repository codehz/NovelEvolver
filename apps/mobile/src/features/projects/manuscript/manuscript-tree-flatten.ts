import type { ManuscriptNode, ManuscriptOutline } from "@novelevolver/domain/worktree";

export type ManuscriptVisibleRow = {
  id: string;
  title: string;
  type: ManuscriptNode["type"];
  depth: number;
  expanded: boolean;
  parentId: string;
  index: number;
};

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

export function flattenVisibleManuscriptRows(
  outline: ManuscriptOutline,
  collapsedIds: Record<string, true> = {},
): ManuscriptVisibleRow[] {
  const result: ManuscriptVisibleRow[] = [];
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

export function sourceSubtreeRange(
  rows: readonly { id: string; depth: number }[],
  sourceId: string,
): { start: number; count: number } | null {
  const start = rows.findIndex((row) => row.id === sourceId);
  if (start < 0) return null;
  const ends = buildSubtreeEndIndexes(rows);
  const end = ends[start] ?? start;
  return { start, count: end - start + 1 };
}

export function manuscriptRowSlotY(index: number, rowHeight: number): number {
  return index * rowHeight;
}

export type ManuscriptVisualRowSlot = {
  id: string;
  y: number;
  ghost: boolean;
};

export function visualManuscriptRowSlots(
  rows: readonly { id: string; depth: number }[],
  draggingId: string | null,
  rowHeight: number,
): { slots: ManuscriptVisualRowSlot[]; slotCount: number } {
  const range = draggingId === null ? null : sourceSubtreeRange(rows, draggingId);
  return {
    slots: rows.map((row, index) => ({
      id: row.id,
      y: manuscriptRowSlotY(index, rowHeight),
      ghost: range !== null && index >= range.start && index < range.start + range.count,
    })),
    slotCount: rows.length,
  };
}

export function buildSubtreeEndIndexes(rows: readonly { depth: number }[]): number[] {
  const endIndexes = rows.map((_, index) => index);
  const openIndexes: number[] = [];
  for (const [index, item] of rows.entries()) {
    while (openIndexes.length > 0) {
      const openIndex = openIndexes[openIndexes.length - 1];
      if (openIndex === undefined) break;
      const openRow = rows[openIndex];
      if (openRow === undefined || openRow.depth < item.depth) break;
      endIndexes[openIndex] = index - 1;
      openIndexes.pop();
    }
    openIndexes.push(index);
  }
  const lastIndex = rows.length - 1;
  while (openIndexes.length > 0) {
    const openIndex = openIndexes.pop();
    if (openIndex !== undefined) endIndexes[openIndex] = lastIndex;
  }
  return endIndexes;
}
