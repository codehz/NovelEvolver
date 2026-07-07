import type { ManuscriptSnapshotState } from "../snapshot-state";

function longestIncreasingSubsequenceIndices(values: readonly number[]): Set<number> {
  if (values.length === 0) {
    return new Set();
  }

  const predecessors = Array.from<number>({ length: values.length }).fill(-1);
  const tails: number[] = [];

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    let left = 0;
    let right = tails.length;

    while (left < right) {
      const middle = Math.floor((left + right) / 2);
      if (values[tails[middle]!]! < value) {
        left = middle + 1;
      } else {
        right = middle;
      }
    }

    if (left > 0) {
      predecessors[index] = tails[left - 1]!;
    }
    tails[left] = index;
  }

  const lisIndices = new Set<number>();
  let cursor = tails.at(-1) ?? -1;
  while (cursor !== -1) {
    lisIndices.add(cursor);
    cursor = predecessors[cursor]!;
  }
  return lisIndices;
}

export function computeMinimalReorderedManuscriptIds(
  base: ManuscriptSnapshotState,
  current: ManuscriptSnapshotState,
): Set<string> {
  const reorderedIds = new Set<string>();
  const parentIds = new Set<string>([
    ...Object.keys(base.outline.nodes),
    ...Object.keys(current.outline.nodes),
  ]);

  for (const parentId of parentIds) {
    const baseParent = base.outline.nodes[parentId];
    const currentParent = current.outline.nodes[parentId];
    if (baseParent?.type !== "folder" || currentParent?.type !== "folder") {
      continue;
    }

    const stableBaseChildren = baseParent.children.filter((id) => {
      const currentEntry = current.entries.get(id);
      return currentEntry?.parentId === parentId;
    });
    if (stableBaseChildren.length <= 1) {
      continue;
    }

    const stableChildIds = new Set(stableBaseChildren);
    const stableCurrentChildren = currentParent.children.filter((id) => stableChildIds.has(id));
    if (stableCurrentChildren.length <= 1) {
      continue;
    }

    const baseIndexById = new Map(stableBaseChildren.map((id, index) => [id, index] as const));
    const currentBaseIndices = stableCurrentChildren.map((id) => baseIndexById.get(id)!);
    const lisIndices = longestIncreasingSubsequenceIndices(currentBaseIndices);

    stableCurrentChildren.forEach((id, index) => {
      if (!lisIndices.has(index)) {
        reorderedIds.add(id);
      }
    });
  }

  return reorderedIds;
}
