import type { ResourceNode, ResourceTreeSnapshot } from "#shared/rpc/projects-rpc";

import { buildSubtreeEndIndexArray, buildTreeRowIndexMap } from "../tree/tree-row-helpers";
import type { ResourceTreeEditingState, ResourceTreeState } from "./state/types";

type FlatTreeNode = {
  visualId: string;
  path: string;
  name: string;
  type: ResourceNode["type"];
  depth: number;
  expanded: boolean;
};

export type ResourceRenderItem = {
  key: string;
  visualId: string | null;
  depth: number;
  type: ResourceNode["type"];
  path: string | null;
  name: string;
  expanded: boolean;
  loading: boolean;
  editing: ResourceTreeEditingState | null;
};

export type ResourceRenderProjection = {
  items: ResourceRenderItem[];
  rowIndexById: Map<string, number>;
  subtreeEndIndexes: readonly number[];
};

function flattenVisibleNodes(
  snapshot: ResourceTreeSnapshot,
  expandedPaths: Record<string, true>,
  nodeVisualIds: Record<string, string>,
): FlatTreeNode[] {
  const result: FlatTreeNode[] = [];

  const visit = (parentPath: string, depth: number): void => {
    const parent = snapshot.nodes[parentPath];
    if (parent?.type !== "folder") {
      return;
    }
    for (const childPath of parent.children) {
      const node = snapshot.nodes[childPath];
      if (node === undefined) {
        continue;
      }
      const expanded = node.type === "folder" && expandedPaths[node.path] === true;
      result.push({
        visualId: nodeVisualIds[node.path] ?? node.path,
        path: node.path,
        name: node.name,
        type: node.type,
        depth,
        expanded,
      });
      if (node.type === "folder" && expanded) {
        visit(node.path, depth + 1);
      }
    }
  };

  visit(snapshot.rootPath, 0);
  return result;
}

export function buildResourceRenderProjection(state: ResourceTreeState): ResourceRenderProjection {
  if (state.snapshot === null) {
    return {
      items: [],
      rowIndexById: new Map(),
      subtreeEndIndexes: [],
    };
  }

  const flatItems = flattenVisibleNodes(state.snapshot, state.expandedPaths, state.nodeVisualIds);
  const rowIndexByPath = buildTreeRowIndexMap(flatItems, (item) => item.path);
  const subtreeEndIndexes = buildSubtreeEndIndexArray(flatItems);
  const items: ResourceRenderItem[] = flatItems.map((item) => ({
    key: item.visualId,
    visualId: item.visualId,
    depth: item.depth,
    type: item.type,
    path: item.path,
    name: item.name,
    expanded: item.expanded,
    loading: false,
    editing: null,
  }));

  if (state.editing?.mode === "renaming") {
    const renaming = state.editing;
    const renameIndex = rowIndexByPath.get(renaming.path);
    if (renameIndex !== undefined) {
      items[renameIndex] = {
        ...items[renameIndex],
        editing: renaming,
      };
    }
  }

  const editing = state.editing;
  if (editing?.mode === "creating") {
    let insertAt = 0;
    let depth = 0;
    const parentIndex =
      editing.parentPath === "" ? undefined : rowIndexByPath.get(editing.parentPath);
    const parentItem = parentIndex === undefined ? undefined : flatItems[parentIndex];
    const parentNode = state.snapshot.nodes[editing.parentPath];

    if (editing.kind === "folder") {
      if (parentIndex !== undefined && parentItem !== undefined) {
        insertAt = parentIndex + 1;
        depth = parentItem.depth + 1;
      }
    } else {
      let lastFolderIndex: number | undefined;
      if (parentNode?.type === "folder") {
        for (const childPath of parentNode.children) {
          if (state.snapshot.nodes[childPath]?.type !== "folder") {
            break;
          }
          const childIndex = rowIndexByPath.get(childPath);
          if (childIndex !== undefined) {
            lastFolderIndex = childIndex;
          }
        }
      }
      if (lastFolderIndex !== undefined) {
        insertAt = subtreeEndIndexes[lastFolderIndex]! + 1;
        depth = flatItems[lastFolderIndex]!.depth;
      } else if (parentIndex !== undefined && parentItem !== undefined) {
        insertAt = parentIndex + 1;
        depth = parentItem.depth + 1;
      }
    }

    items.splice(insertAt, 0, {
      key: `creating-${editing.id}`,
      visualId: null,
      depth,
      type: editing.kind,
      path: null,
      name: "",
      expanded: false,
      loading: false,
      editing,
    });
  }

  return {
    items,
    rowIndexById: buildTreeRowIndexMap(items, (item) => item.path),
    subtreeEndIndexes: buildSubtreeEndIndexArray(items),
  };
}
