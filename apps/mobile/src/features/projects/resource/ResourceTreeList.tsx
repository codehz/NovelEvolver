import type { ResourceTreeNode, ResourceTreeSnapshot } from "@novelevolver/domain/worktree";

import { ExplorerTreeList } from "../explorer/ExplorerTreeList";
import { flattenVisibleResourceRows } from "./resource-tree-flatten";
import { resolveResourceDrop } from "./resource-tree-placement";

type ResourceTreeListProps = {
  tree: ResourceTreeSnapshot;
  selectedNodeId: string | null;
  onOpenFile: (nodeId: string) => void;
  onRename: (node: ResourceTreeNode) => void;
  onDelete: (node: ResourceTreeNode) => void;
  onMove: (sourceId: string, parentId: string) => void;
};

export function ResourceTreeList({
  tree,
  selectedNodeId,
  onOpenFile,
  onRename,
  onDelete,
  onMove,
}: ResourceTreeListProps) {
  return (
    <ExplorerTreeList
      flatten={(collapsedIds) => flattenVisibleResourceRows(tree, collapsedIds)}
      selectedNodeId={selectedNodeId}
      emptyText="空资源库。使用上方按钮创建文件夹或文件。"
      getNode={(id) => tree.nodes[id]}
      onOpenLeaf={onOpenFile}
      onRename={onRename}
      onDelete={onDelete}
      onMove={(sourceId, parentId) => {
        onMove(sourceId, parentId);
      }}
      resolveDrop={({ rows, sourceId, pointerContentY, rowHeight }) =>
        resolveResourceDrop({
          tree,
          rows,
          sourceId,
          pointerContentY,
          rowHeight,
        })
      }
    />
  );
}
