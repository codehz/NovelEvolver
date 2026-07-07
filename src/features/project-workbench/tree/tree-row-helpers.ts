export type TreeDepthItem = {
  depth: number;
};

export function buildSubtreeEndIndexArray<TItem extends TreeDepthItem>(
  items: readonly TItem[],
): number[] {
  const endIndexes = items.map((_, index) => index);
  const openIndexes: number[] = [];

  for (const [index, item] of items.entries()) {
    while (
      openIndexes.length > 0 &&
      items[openIndexes[openIndexes.length - 1]!]!.depth >= item.depth
    ) {
      const openIndex = openIndexes.pop()!;
      endIndexes[openIndex] = index - 1;
    }
    openIndexes.push(index);
  }

  const lastIndex = items.length - 1;
  while (openIndexes.length > 0) {
    endIndexes[openIndexes.pop()!] = lastIndex;
  }

  return endIndexes;
}

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
