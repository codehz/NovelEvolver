export type TreeDepthItem = {
  depth: number;
};

export function findSubtreeEndIndex<TItem extends TreeDepthItem>(
  items: readonly TItem[],
  startIndex: number,
): number {
  const startItem = items[startIndex];
  if (startItem === undefined) {
    return startIndex;
  }

  let endIndex = startIndex;
  while (endIndex + 1 < items.length && items[endIndex + 1]!.depth > startItem.depth) {
    endIndex += 1;
  }
  return endIndex;
}

export function buildTreeRowIndexMap<TItem, TId extends string>(
  items: readonly TItem[],
  getId: (item: TItem) => TId | null | undefined,
): Map<TId, number> {
  const indexMap = new Map<TId, number>();

  for (const [index, item] of items.entries()) {
    const id = getId(item);
    if (id !== null && id !== undefined) {
      indexMap.set(id, index);
    }
  }

  return indexMap;
}
