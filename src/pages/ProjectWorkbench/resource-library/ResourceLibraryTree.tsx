import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useEffectEvent, useLayoutEffect, useMemo, useRef } from "react";

import { resourceLibraryDirPathPrefixes } from "#shared/resource-library-path";
import type { ResourceTreeSnapshot } from "#shared/rpc/projects-rpc";

import { FlatTreeList } from "../tree/FlatTreeList";
import type { TreeResolvedDrop, TreeRowHoverZone } from "../tree/tree-drag";
import { queryTreeRowById } from "../tree/tree-row-dom";
import type { TreeRowDomData } from "../tree/tree-row-dom";
import { buildSubtreeEndIndexArray, buildTreeRowIndexMap } from "../tree/tree-row-helpers";
import { TREE_ROW_HEIGHT_PX } from "../tree/tree-row-motion";
import { isInvalidDropTarget, resolveDropTargetFromRow } from "./drag-hit-test";
import { ResourceLibraryTreeRow } from "./ResourceLibraryTreeRow";
import { resourceLibraryTreeMolecule } from "./state/resource-tree-molecule";
import type { FlatRenderItem } from "./state/tree-data-reducer";
import type { ResourceTreeDragState } from "./state/types";
import { useResourceLibraryTreeActions } from "./state/use-resource-library-tree-actions";

function ResourceLibraryTreeContent({
  renderItems,
  snapshot,
  selectedPath,
  drag,
}: {
  renderItems: FlatRenderItem[];
  snapshot: ResourceTreeSnapshot | null;
  selectedPath: string | null;
  drag: ResourceTreeDragState | null;
}) {
  const { activateNode, startRenaming, cancelEditing, submitEditing, deleteNode, moveNode } =
    useResourceLibraryTreeActions();
  const { treeAtom, onRevealRequest } = useMolecule(resourceLibraryTreeMolecule);
  const dispatch = useSetAtom(treeAtom);
  const store = useStore();
  const listRef = useRef<HTMLUListElement>(null);
  const pendingRevealRef = useRef<string | null>(null);
  const renderItemsRef = useRef(renderItems);
  const rowIndexByPathRef = useRef<Map<string, number>>(new Map());
  const snapshotRef = useRef(snapshot);
  const rowIndexByPath = useMemo(
    () => buildTreeRowIndexMap(renderItems, (item) => item.path),
    [renderItems],
  );
  const subtreeEndIndexes = useMemo(() => buildSubtreeEndIndexArray(renderItems), [renderItems]);

  renderItemsRef.current = renderItems;
  rowIndexByPathRef.current = rowIndexByPath;
  snapshotRef.current = snapshot;

  const revealPath = useEffectEvent((targetPath: string) => {
    if (targetPath === "") {
      pendingRevealRef.current = null;
      listRef.current?.scrollIntoView({ block: "start" });
      dispatch({ type: "select", path: "", nodeType: "folder" });
      return;
    }
    const currentSnapshot = snapshotRef.current;
    if (currentSnapshot?.nodes[targetPath] === undefined) {
      pendingRevealRef.current = null;
      return;
    }
    const parentPrefixes = resourceLibraryDirPathPrefixes(targetPath).slice(0, -1);
    if (parentPrefixes.length > 0) {
      dispatch({ type: "expandPaths", paths: parentPrefixes });
    }
    const itemIndex = rowIndexByPathRef.current.get(targetPath);
    if (itemIndex === undefined) {
      pendingRevealRef.current = targetPath;
      return;
    }
    const item = renderItemsRef.current[itemIndex];
    if (item === undefined) {
      pendingRevealRef.current = targetPath;
      return;
    }
    pendingRevealRef.current = null;
    dispatch({ type: "select", path: targetPath, nodeType: item.type });
    const row = listRef.current ? queryTreeRowById(listRef.current, targetPath) : null;
    row?.scrollIntoView({ block: "nearest" });
  });

  useLayoutEffect(() => {
    return onRevealRequest(revealPath);
  }, [onRevealRequest, revealPath]);

  useLayoutEffect(() => {
    if (pendingRevealRef.current !== null) {
      revealPath(pendingRevealRef.current);
    }
  }, [renderItems, revealPath]);

  const handleDragStart = useCallback(
    (sourcePath: string, sourceType: "file" | "folder") => {
      dispatch({ type: "dragStart", sourcePath, sourceType });
    },
    [dispatch],
  );

  const handleDragMove = useCallback(
    (resolved: TreeResolvedDrop<string> | null) => {
      dispatch({ type: "dragMove", resolved });
    },
    [dispatch],
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
      if (snapshot === null) {
        return null;
      }
      const listHeight = renderItems.length * TREE_ROW_HEIGHT_PX;
      if (hoveredRow === null) {
        if (isInvalidDropTarget(snapshot, start.rowId, start.rowType, "")) {
          return null;
        }
        return {
          preview: { kind: "highlight", top: 0, height: listHeight },
          target: "",
        };
      }
      const targetPath = resolveDropTargetFromRow(
        snapshot,
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
      const targetIndex = rowIndexByPath.get(targetPath);
      if (targetIndex === undefined) {
        return null;
      }
      const targetItem = renderItems[targetIndex];
      if (targetItem?.type !== "folder") {
        return null;
      }
      const endIndex = subtreeEndIndexes[targetIndex];
      if (endIndex === undefined) {
        return null;
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
    [renderItems.length, rowIndexByPath, snapshot, subtreeEndIndexes],
  );

  const handleDragEnd = useCallback(() => {
    const currentDrag = store.get(treeAtom).drag;
    dispatch({ type: "dragEnd" });
    if (
      currentDrag === null ||
      currentDrag.resolved === null ||
      currentDrag.resolved.target === currentDrag.sourcePath
    ) {
      return;
    }
    void moveNode(currentDrag.sourcePath, currentDrag.sourceType, currentDrag.resolved.target);
  }, [dispatch, moveNode, store, treeAtom]);

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
        dispatch({ type: "dragEnd" });
      }}
      renderRow={(item, index, layout) => (
        <ResourceLibraryTreeRow
          animateEnter={layout.animateEnter}
          dragging={drag !== null}
          height={layout.height}
          index={index}
          item={item}
          listRef={listRef}
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
  const { treeAtom, flatRenderItemsAtom, selectedPathAtom } = useMolecule(
    resourceLibraryTreeMolecule,
  );
  const state = useAtomValue(treeAtom);
  const renderItems = useAtomValue(flatRenderItemsAtom);
  const selectedPath = useAtomValue(selectedPathAtom);

  if (state.status === "loading" || state.status === "idle") {
    return <p className="px-2 py-1 text-xs text-ctp-subtext0">加载资源库…</p>;
  }

  if (state.status === "error") {
    return (
      <p className="px-2 py-1 text-xs text-ctp-red" role="alert">
        {state.error}
      </p>
    );
  }

  return (
    <ResourceLibraryTreeContent
      renderItems={renderItems}
      snapshot={state.snapshot}
      selectedPath={selectedPath}
      drag={state.drag}
    />
  );
}
