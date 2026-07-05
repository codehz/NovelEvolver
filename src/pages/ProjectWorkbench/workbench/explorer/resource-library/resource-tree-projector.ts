import type { FileChangeStatus, ResourceTreeNode } from "#shared/rpc/worktree-tree";

import { buildSubtreeEndIndexArray, buildTreeRowIndexMap } from "../../tree/tree-row-helpers";
import { flattenResourceTree } from "./resource-tree";
import type { ResourceTreeEditingState, ResourceTreeState } from "./state/types";

export type ResourceRenderItem = {
  key: string;
  visualId: string | null;
  depth: number;
  type: ResourceTreeNode["type"];
  id: string | null;
  name: string;
  expanded: boolean;
  loading: boolean;
  editing: ResourceTreeEditingState | null;
  changeStatus?: FileChangeStatus;
};

export type ResourceRenderProjection = {
  items: ResourceRenderItem[];
  rowIndexById: Map<string, number>;
  subtreeEndIndexes: readonly number[];
};

export function buildResourceRenderProjection(state: ResourceTreeState): ResourceRenderProjection {
  if (state.snapshot === null) {
    return {
      items: [],
      rowIndexById: new Map(),
      subtreeEndIndexes: [],
    };
  }

  const flatItems = flattenResourceTree(state.snapshot, state.expandedPaths);
  const baseRowIndexById = buildTreeRowIndexMap(flatItems, (item) => item.id);
  const baseSubtreeEndIndexes = buildSubtreeEndIndexArray(flatItems);
  const items: ResourceRenderItem[] = flatItems.map((item) => ({
    key: state.nodeVisualIds[item.id] ?? item.id,
    visualId: state.nodeVisualIds[item.id] ?? item.id,
    depth: item.depth,
    type: item.type,
    id: item.id,
    name: item.name,
    expanded: item.expanded,
    loading: false,
    changeStatus: state.snapshot?.nodes[item.id]?.changeStatus,
    editing:
      state.editing?.mode === "renaming" && state.editing.id === item.id ? state.editing : null,
  }));

  const editing = state.editing;
  if (editing?.mode === "creating") {
    const parentIndex =
      editing.parentId === state.snapshot.rootId
        ? undefined
        : baseRowIndexById.get(editing.parentId);
    const parentItem = parentIndex === undefined ? undefined : flatItems[parentIndex];
    let insertAt = 0;
    let depth = 0;

    if (parentItem !== undefined) {
      const subtreeEnd = baseSubtreeEndIndexes[parentIndex!] ?? parentIndex!;
      insertAt = subtreeEnd + 1;
      depth = parentItem.depth + 1;
    }

    items.splice(insertAt, 0, {
      key: `creating-${editing.id}`,
      visualId: null,
      depth,
      type: editing.kind,
      id: null,
      name: "",
      expanded: false,
      loading: false,
      changeStatus: undefined,
      editing,
    });
  }

  return {
    items,
    rowIndexById: buildTreeRowIndexMap(items, (item) => item.id),
    subtreeEndIndexes: buildSubtreeEndIndexArray(items),
  };
}
