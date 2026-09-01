import type { ManuscriptNode, ManuscriptOutline } from "@novelevolver/domain/worktree";

import { ExplorerTreeList } from "../explorer/ExplorerTreeList";
import { flattenVisibleManuscriptRows } from "./manuscript-tree-flatten";
import { resolveManuscriptDrop } from "./manuscript-tree-placement";

type ManuscriptTreeListProps = {
  outline: ManuscriptOutline;
  selectedNodeId: string | null;
  onOpenChapter: (nodeId: string) => void;
  onRename: (node: ManuscriptNode) => void;
  onDelete: (node: ManuscriptNode) => void;
  onMove: (sourceId: string, parentId: string, index?: number) => void;
};

export function ManuscriptTreeList({
  outline,
  selectedNodeId,
  onOpenChapter,
  onRename,
  onDelete,
  onMove,
}: ManuscriptTreeListProps) {
  return (
    <ExplorerTreeList
      flatten={(collapsedIds) => flattenVisibleManuscriptRows(outline, collapsedIds)}
      selectedNodeId={selectedNodeId}
      emptyText="空 manuscript。使用上方按钮创建文件夹或章节。"
      getNode={(id) => outline.nodes[id]}
      onOpenLeaf={onOpenChapter}
      onRename={onRename}
      onDelete={onDelete}
      onMove={onMove}
      resolveDrop={({ rows, sourceId, pointerContentY, rowHeight }) => {
        const source = outline.nodes[sourceId];
        if (source === undefined) return null;
        return resolveManuscriptDrop({
          outline,
          rows,
          sourceId,
          sourceType: source.type,
          pointerContentY,
          rowHeight,
        });
      }}
    />
  );
}
