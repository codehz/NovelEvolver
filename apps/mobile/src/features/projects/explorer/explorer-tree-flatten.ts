export type ExplorerRowType = "folder" | "chapter" | "file";

export type ExplorerVisibleRow = {
  id: string;
  title: string;
  type: ExplorerRowType;
  depth: number;
  expanded: boolean;
  parentId: string;
  index: number;
};

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

export function explorerRowSlotY(index: number, rowHeight: number): number {
  return index * rowHeight;
}

export type ExplorerVisualRowSlot = {
  id: string;
  y: number;
  ghost: boolean;
};

export function visualExplorerRowSlots(
  rows: readonly { id: string; depth: number }[],
  draggingId: string | null,
  rowHeight: number,
): { slots: ExplorerVisualRowSlot[]; slotCount: number } {
  const range = draggingId === null ? null : sourceSubtreeRange(rows, draggingId);
  return {
    slots: rows.map((row, index) => ({
      id: row.id,
      y: explorerRowSlotY(index, rowHeight),
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
