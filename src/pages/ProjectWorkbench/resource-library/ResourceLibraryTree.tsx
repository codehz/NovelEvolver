import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useLayoutEffect, useRef } from "react";

import { FlatTreeList } from "../tree/FlatTreeList";
import type { TreeResolvedDrop, TreeRowHoverZone } from "../tree/tree-drag";
import { queryTreeRowById } from "../tree/tree-row-dom";
import type { TreeRowDomData } from "../tree/tree-row-dom";
import { TREE_ROW_HEIGHT_PX } from "../tree/tree-row-motion";
import { resolveDropTargetFromRow } from "./drag-hit-test";
import { ResourceLibraryTreeRow } from "./ResourceLibraryTreeRow";
import { resourceLibraryTreeMolecule } from "./state/resource-tree-molecule";
import type { FlatRenderItem } from "./state/tree-data-reducer";
import type { ResourceTreeDragState } from "./state/types";
import { useResourceLibraryTreeActions } from "./state/use-resource-library-tree-actions";

function ResourceLibraryTreeContent({
  renderItems,
  selectedPath,
  drag,
}: {
  renderItems: FlatRenderItem[];
  selectedPath: string | null;
  drag: ResourceTreeDragState | null;
}) {
  const { activateNode, startRenaming, cancelEditing, submitEditing, deleteNode, moveNode } =
    useResourceLibraryTreeActions();
  const { treeUiAtom, onRevealRequest } = useMolecule(resourceLibraryTreeMolecule);
  const dispatchUi = useSetAtom(treeUiAtom);
  const store = useStore();
  const listRef = useRef<HTMLUListElement>(null);
  const pendingRevealRef = useRef<string | null>(null);

  const revealPath = useCallback(
    (targetPath: string) => {
      // 根路径：滚动到列表顶部即可。
      if (targetPath === "") {
        pendingRevealRef.current = null;
        listRef.current?.scrollIntoView({ block: "start" });
        return;
      }
      const item = renderItems.find((candidate) => candidate.path === targetPath);
      if (item === undefined) {
        pendingRevealRef.current = targetPath; // 父级尚未展开/加载，等待重试
        return;
      }
      pendingRevealRef.current = null;
      dispatchUi({ type: "select", path: targetPath, nodeType: item.type });
      const row = listRef.current ? queryTreeRowById(listRef.current, targetPath) : null;
      row?.scrollIntoView({ block: "nearest" });
    },
    [renderItems, dispatchUi],
  );

  // 注册一条命令通道：breadcrumb 调用 revealInTree(path) 即触发此回调。
  useLayoutEffect(() => {
    return onRevealRequest(revealPath);
  }, [onRevealRequest, revealPath]);

  // breadcrumb 定位请求：父级目录异步加载后重试 pending 的 reveal。
  useLayoutEffect(() => {
    if (pendingRevealRef.current !== null) {
      revealPath(pendingRevealRef.current);
    }
  }, [renderItems, revealPath]);

  const handleDragStart = useCallback(
    (sourcePath: string, sourceType: "file" | "folder") => {
      dispatchUi({ type: "dragStart", sourcePath, sourceType });
    },
    [dispatchUi],
  );

  const handleDragMove = useCallback(
    (resolved: TreeResolvedDrop<string> | null) => {
      dispatchUi({ type: "dragMove", resolved });
    },
    [dispatchUi],
  );

  const resolveDropTarget = useCallback(
    ({
      start,
      hoveredRow,
      hoverZone: _hoverZone,
      listRect: _listRect,
      clientX: _clientX,
      clientY: _clientY,
    }: {
      start: { rowId: string; rowType: "file" | "folder" };
      hoveredRow: TreeRowDomData<"file" | "folder"> | null;
      hoverZone: TreeRowHoverZone | null;
      listRect: DOMRect | null;
      clientX: number;
      clientY: number;
    }): TreeResolvedDrop<string> | null => {
      const listHeight = renderItems.length * TREE_ROW_HEIGHT_PX;
      if (hoveredRow === null) {
        return {
          preview: { kind: "highlight", top: 0, height: listHeight },
          target: "",
        };
      }
      const targetPath = resolveDropTargetFromRow(
        hoveredRow.rowId,
        hoveredRow.rowType,
        start.rowId,
        start.rowType,
      );
      if (targetPath === null) {
        return null;
      }
      if (targetPath === "") {
        return {
          preview: { kind: "highlight", top: 0, height: listHeight },
          target: "",
        };
      }
      const targetIndex = renderItems.findIndex((item) => item.path === targetPath);
      const targetItem = targetIndex >= 0 ? renderItems[targetIndex] : null;
      if (targetItem === null || targetItem.type !== "folder") {
        return null;
      }
      let endIndex = targetIndex;
      while (
        endIndex + 1 < renderItems.length &&
        renderItems[endIndex + 1]!.depth > targetItem.depth
      ) {
        endIndex += 1;
      }
      return {
        preview: {
          kind: "highlight",
          top: targetIndex * TREE_ROW_HEIGHT_PX,
          height: (endIndex - targetIndex + 1) * TREE_ROW_HEIGHT_PX,
        },
        target: targetPath,
      };
    },
    [renderItems],
  );

  const handleDragEnd = useCallback(() => {
    // 从 store 读取最新 drag，避免闭包捕获渲染快照导致的陈旧值。
    const currentDrag = store.get(treeUiAtom).drag;
    dispatchUi({ type: "dragEnd" });
    if (
      currentDrag === null ||
      currentDrag.resolved === null ||
      currentDrag.resolved.target === currentDrag.sourcePath
    ) {
      return;
    }
    void moveNode(currentDrag.sourcePath, currentDrag.sourceType, currentDrag.resolved.target);
  }, [dispatchUi, moveNode, store, treeUiAtom]);

  if (renderItems.length === 0) {
    return <p className="px-2 py-1 text-xs text-ctp-subtext0">资源库为空。</p>;
  }

  return (
    <FlatTreeList
      items={renderItems}
      getItemKey={(item) => item.key}
      listRef={listRef}
      dropPreview={drag?.resolved?.preview ?? null}
      dragging={drag !== null}
      onRequestRename={startRenaming}
      onRequestDelete={deleteNode}
      onCancelDrag={() => {
        dispatchUi({ type: "dragEnd" });
      }}
      renderRow={(item, index, layout) => (
        <ResourceLibraryTreeRow
          animateEnter={layout.animateEnter}
          dragging={drag !== null}
          height={layout.height}
          index={index}
          item={item}
          resolveDropTarget={resolveDropTarget}
          selectedPath={selectedPath}
          y={layout.y}
          onActivate={activateNode}
          onCancelEditing={cancelEditing}
          onDragEnd={handleDragEnd}
          onDragMove={handleDragMove}
          onDragStart={handleDragStart}
          onSubmitEditing={submitEditing}
        />
      )}
    />
  );
}

export function ResourceLibraryTree() {
  const { treeDataAtom, flatRenderItemsAtom, selectedPathAtom, treeUiAtom } = useMolecule(
    resourceLibraryTreeMolecule,
  );
  const data = useAtomValue(treeDataAtom);
  const renderItems = useAtomValue(flatRenderItemsAtom);
  const selectedPath = useAtomValue(selectedPathAtom);
  const ui = useAtomValue(treeUiAtom);

  if (data.status === "loading" || data.status === "idle") {
    return <p className="px-2 py-1 text-xs text-ctp-subtext0">加载资源库…</p>;
  }

  if (data.status === "error") {
    return (
      <p className="px-2 py-1 text-xs text-ctp-red" role="alert">
        {data.error}
      </p>
    );
  }

  return (
    <ResourceLibraryTreeContent
      renderItems={renderItems}
      selectedPath={selectedPath}
      drag={ui.drag}
    />
  );
}
