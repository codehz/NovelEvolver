import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useEffectEvent, useLayoutEffect, useMemo, useRef } from "react";

import { SidebarHeaderActionButton } from "#app/components/workbench";
import { resourceLibraryDirPathPrefixes } from "#shared/resource-library-path";

import { queryTreeRowById } from "../tree/tree-row-dom";
import { TreePane } from "../tree/TreePane";
import type { TreeDropResolveInput } from "../tree/use-tree-row-pointer-drag";
import { resolveResourceDropTarget } from "./resource-tree-placement-policy";
import { buildResourceRenderProjection, type ResourceRenderItem } from "./resource-tree-projector";
import { ResourceLibraryTreeRow } from "./ResourceLibraryTreeRow";
import { resourceLibraryTreeMolecule } from "./state/resource-tree-molecule";
import { useResourceLibraryTreeActions } from "./state/use-resource-library-tree-actions";
import { useResourceTreeSync } from "./state/use-resource-tree-sync";

export function ResourceLibrarySectionBody() {
  useResourceTreeSync();
  const { treeAtom, onRevealRequest } = useMolecule(resourceLibraryTreeMolecule);
  const state = useAtomValue(treeAtom);
  const dispatch = useSetAtom(treeAtom);
  const store = useStore();
  const listRef = useRef<HTMLUListElement>(null);
  const pendingRevealRef = useRef<string | null>(null);
  const projection = useMemo(() => buildResourceRenderProjection(state), [state]);
  const itemsRef = useRef(projection.items);
  const rowIndexByPathRef = useRef(projection.rowIndexById);
  const snapshotRef = useRef(state.snapshot);
  const {
    startCreating,
    activateNode,
    startRenaming,
    cancelEditing,
    submitEditing,
    deleteNode,
    moveNode,
  } = useResourceLibraryTreeActions();

  itemsRef.current = projection.items;
  rowIndexByPathRef.current = projection.rowIndexById;
  snapshotRef.current = state.snapshot;

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
    const item = itemsRef.current[itemIndex];
    if (item === undefined) {
      pendingRevealRef.current = targetPath;
      return;
    }
    pendingRevealRef.current = null;
    dispatch({ type: "select", path: targetPath, nodeType: item.type });
    const row = listRef.current ? queryTreeRowById(listRef.current, targetPath) : null;
    row?.scrollIntoView({ block: "nearest" });
  });

  useLayoutEffect(() => onRevealRequest(revealPath), [onRevealRequest, revealPath]);

  useLayoutEffect(() => {
    if (pendingRevealRef.current !== null) {
      revealPath(pendingRevealRef.current);
    }
  }, [projection.items, revealPath]);

  const resolveDropTarget = useCallback(
    (input: TreeDropResolveInput<"file" | "folder">) => {
      const snapshot = store.get(treeAtom).snapshot;
      if (snapshot === null) {
        return null;
      }
      return resolveResourceDropTarget({
        snapshot,
        projection,
        ...input,
      });
    },
    [projection, store, treeAtom],
  );

  return (
    <TreePane<ResourceRenderItem, "file" | "folder", string>
      listRef={listRef}
      headerActions={
        <>
          <SidebarHeaderActionButton
            label="新建文件"
            icon="icon-[codicon--new-file]"
            onClick={() => {
              startCreating("file");
            }}
          />
          <SidebarHeaderActionButton
            label="新建文件夹"
            icon="icon-[codicon--new-folder]"
            onClick={() => {
              startCreating("folder");
            }}
          />
        </>
      }
      status={state.status}
      error={state.error}
      isEmpty={projection.items.length === 0}
      loadingLabel="加载资源库…"
      emptyLabel="资源库为空。"
      items={projection.items}
      getItemKey={(item) => item.key}
      dropPreview={state.drag?.resolved?.preview ?? null}
      dragging={state.drag !== null}
      onRequestRename={startRenaming}
      onRequestDelete={deleteNode}
      getCurrentDrag={() => {
        const drag = store.get(treeAtom).drag;
        if (drag === null) {
          return null;
        }
        return {
          sourceId: drag.sourcePath,
          sourceType: drag.sourceType,
          resolved: drag.resolved,
        };
      }}
      dispatchDragStart={(sourceId, sourceType) => {
        dispatch({ type: "dragStart", sourcePath: sourceId, sourceType });
      }}
      dispatchDragMove={(resolved) => {
        dispatch({ type: "dragMove", resolved });
      }}
      dispatchDragEnd={() => {
        dispatch({ type: "dragEnd" });
      }}
      commitResolvedDrop={async (drag) => {
        await moveNode(drag.sourceId, drag.sourceType, drag.resolved.target);
      }}
      shouldCommitDrop={(drag) => drag.resolved.target !== drag.sourceId}
      resolveDropTarget={resolveDropTarget}
      renderRow={({
        item,
        index,
        layout,
        listRef: rowListRef,
        dragging,
        resolveDropTarget: resolveDrop,
        onDragStart,
        onDragMove,
        onDragEnd,
      }) => (
        <ResourceLibraryTreeRow
          animateEnter={layout.animateEnter}
          dragging={dragging}
          height={layout.height}
          index={index}
          item={item}
          listRef={rowListRef}
          resolveDropTarget={resolveDrop}
          selectedPath={state.selected?.path ?? null}
          y={layout.y}
          onActivate={activateNode}
          onCancelEditing={cancelEditing}
          onDragEnd={onDragEnd}
          onDragMove={onDragMove}
          onDragStart={onDragStart}
          onSubmitEditing={submitEditing}
        />
      )}
    />
  );
}
