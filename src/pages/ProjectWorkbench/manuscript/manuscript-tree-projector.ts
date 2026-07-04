import type { ManuscriptNode, ManuscriptOutline } from "#shared/rpc/projects-rpc";

import { buildSubtreeEndIndexArray, buildTreeRowIndexMap } from "../tree/tree-row-helpers";
import { flattenManuscriptTree } from "./manuscript-tree";
import type { ManuscriptEditingState, ManuscriptTreeState } from "./state/types";

export type ManuscriptRenderItem = {
  id: string | null;
  title: string;
  type: ManuscriptNode["type"];
  depth: number;
  expanded: boolean;
  key: string;
  editing: ManuscriptEditingState | null;
};

export type ManuscriptRenderProjection = {
  items: ManuscriptRenderItem[];
  rowIndexById: Map<string, number>;
  subtreeEndIndexes: readonly number[];
};

function resolveCreatingRenderPosition(
  items: ManuscriptRenderItem[],
  rowIndexById: Map<string, number>,
  subtreeEndIndexes: readonly number[],
  editing: Extract<ManuscriptEditingState, { mode: "creating" }>,
  outline: ManuscriptOutline,
): { insertAt: number; depth: number } {
  const parent = outline.nodes[editing.parentId];
  if (parent?.type !== "folder") {
    return { insertAt: items.length, depth: 0 };
  }

  const parentIndex = rowIndexById.get(editing.parentId) ?? -1;
  const parentDepth = editing.parentId === outline.rootId ? -1 : items[parentIndex]?.depth;
  const depth = parentDepth === undefined ? 0 : parentDepth + 1;
  const index = Math.max(0, Math.min(parent.children.length, Math.trunc(editing.index)));

  if (index === 0) {
    return { insertAt: parentIndex >= 0 ? parentIndex + 1 : 0, depth };
  }

  const previousSiblingId = parent.children[index - 1];
  const previousSiblingIndex = rowIndexById.get(previousSiblingId) ?? -1;
  if (previousSiblingIndex < 0) {
    return { insertAt: items.length, depth };
  }

  const previousSiblingEndIndex = subtreeEndIndexes[previousSiblingIndex];
  return { insertAt: (previousSiblingEndIndex ?? previousSiblingIndex) + 1, depth };
}

export function buildManuscriptRenderProjection(
  state: ManuscriptTreeState,
): ManuscriptRenderProjection {
  const flatItems =
    state.outline === null ? [] : flattenManuscriptTree(state.outline, state.expandedIds);
  const baseRowIndexById = buildTreeRowIndexMap(flatItems, (item) => item.id);
  const baseSubtreeEndIndexes = buildSubtreeEndIndexArray(flatItems);

  const items: ManuscriptRenderItem[] = flatItems.map((item) => ({
    ...item,
    key: item.id,
    editing:
      state.editing?.mode === "renaming" && state.editing.id === item.id ? state.editing : null,
  }));

  const editing = state.editing;
  if (editing?.mode === "creating") {
    const position =
      state.outline === null
        ? { insertAt: items.length, depth: 0 }
        : resolveCreatingRenderPosition(
            items,
            baseRowIndexById,
            baseSubtreeEndIndexes,
            editing,
            state.outline,
          );
    items.splice(position.insertAt, 0, {
      id: null,
      title: "",
      type: editing.kind,
      depth: position.depth,
      expanded: false,
      key: `creating-${editing.id}`,
      editing,
    });
  }

  return {
    items,
    rowIndexById: buildTreeRowIndexMap(items, (item) => item.id),
    subtreeEndIndexes: buildSubtreeEndIndexArray(items),
  };
}
