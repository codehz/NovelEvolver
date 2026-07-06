import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useMemo, useRef } from "react";

import { SidebarHeaderActionButton } from "#app/components/workbench";
import type { ResourceTreeNode } from "#shared/rpc/worktree-tree-rpc";

import { queryTreeRowById } from "../../tree/tree-row-dom";
import { TreePane } from "../../tree/TreePane";
import { useTreeRevealRequest } from "../../tree/use-tree-reveal-request";
import type { TreeDropResolveInput } from "../../tree/use-tree-row-pointer-drag";
import { resourceParentChain } from "./resource-tree";
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
  const projection = useMemo(() => buildResourceRenderProjection(state), [state]);
  const {
    startCreating,
    activateNode,
    startRenaming,
    cancelEditing,
    submitEditing,
    deleteNode,
    moveNode,
  } = useResourceLibraryTreeActions();

  useTreeRevealRequest({
    onRevealRequest,
    retryDeps: [projection.items],
    reveal: (targetId) => {
      const currentSnapshot = state.snapshot;
      if (currentSnapshot === null) {
        return "retry";
      }

      const targetNode = currentSnapshot.nodes[targetId];
      if (targetNode === undefined) {
        return "done";
      }

      if (targetId === currentSnapshot.rootId) {
        listRef.current?.scrollIntoView({ block: "start" });
        dispatch({ type: "select", id: targetId, nodeType: "folder" });
        return "done";
      }

      const ancestorIds = resourceParentChain(currentSnapshot, targetId)
        .map((node) => node.id)
        .slice(0, -1);
      if (ancestorIds.length > 0) {
        dispatch({ type: "expandPaths", ids: ancestorIds });
      }

      const itemIndex = projection.rowIndexById.get(targetId);
      const item = itemIndex === undefined ? undefined : projection.items[itemIndex];
      if (item === undefined) {
        return "retry";
      }

      dispatch({ type: "select", id: targetId, nodeType: item.type });
      const row = listRef.current ? queryTreeRowById(listRef.current, targetId) : null;
      row?.scrollIntoView({ block: "nearest" });
      return "done";
    },
  });

  const resolveDropTarget = useCallback(
    (input: TreeDropResolveInput<ResourceTreeNode["type"]>) => {
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
    <TreePane<ResourceRenderItem, ResourceTreeNode["type"], string>
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
      getCurrentDrag={() => store.get(treeAtom).drag}
      dispatchDragStart={(sourceId, sourceType) => {
        dispatch({ type: "dragStart", sourceId, sourceType });
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
          dragging={dragging}
          index={index}
          item={item}
          layout={layout}
          listRef={rowListRef}
          resolveDropTarget={resolveDrop}
          selectedId={state.selected?.id ?? null}
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
