import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useMemo, useRef } from "react";

import type { ResourceTreeNode } from "#shared/rpc/worktree-tree-rpc";
import { SidebarHeaderActionButton, SidebarHeaderActions } from "#workbench/chrome";

import { TreeBody } from "../../tree/TreeBody";
import type { TreeDropResolveInput } from "../../tree/use-tree-row-pointer-drag";
import { useContentTreeReveal } from "../shared/content-tree-reveal";
import { resourceParentChain } from "./resource-tree";
import { resolveResourceDropTarget } from "./resource-tree-placement-policy";
import { buildResourceRenderProjection, type ResourceRenderItem } from "./resource-tree-projector";
import { ResourceLibraryTreeRow } from "./ResourceLibraryTreeRow";
import { resourceLibraryTreeMolecule } from "./state/resource-tree-molecule";
import { useResourceLibraryTreeActions } from "./state/use-resource-library-tree-actions";
import { useResourceTreeSync } from "./state/use-resource-tree-sync";

export function ResourceLibrarySectionBody() {
  useResourceTreeSync();
  const { treeAtom, onRevealRequest, retryPendingReveal } = useMolecule(
    resourceLibraryTreeMolecule,
  );
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

  useContentTreeReveal({
    snapshot: state.snapshot,
    projection,
    listRef,
    onRevealRequest,
    retryPendingReveal,
    handlers: {
      parentChain: resourceParentChain,
      revealRoot: (snapshot) => {
        dispatch({ type: "select", id: snapshot.rootId, nodeType: "folder" });
      },
      expandAncestors: (ancestorIds) => {
        if (ancestorIds.length > 0) {
          dispatch({ type: "expandPaths", ids: [...ancestorIds] });
        }
      },
      selectTarget: (targetId, item) => {
        dispatch({ type: "select", id: targetId, nodeType: item.type });
      },
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
    <>
      <SidebarHeaderActions>
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
      </SidebarHeaderActions>
      <TreeBody<ResourceRenderItem, ResourceTreeNode["type"], string>
        listRef={listRef}
        status={state.status}
        isEmpty={projection.items.length === 0}
        loadingContent={<p className="px-2 py-1 text-xs text-ctp-subtext0">加载资源库…</p>}
        errorContent={
          state.error === null ? null : (
            <p className="px-2 py-1 text-xs text-ctp-red" role="alert">
              {state.error}
            </p>
          )
        }
        emptyContent={<p className="px-2 py-1 text-xs text-ctp-subtext0">资源库为空。</p>}
        items={projection.items}
        getItemKey={(item) => item.key}
        dropPreview={state.drag?.resolved?.preview ?? null}
        dragging={state.drag !== null}
        onRequestRename={startRenaming}
        onRequestDelete={deleteNode}
        dragController={{
          getCurrentDrag: () => store.get(treeAtom).drag,
          dispatchDragStart: (sourceId, sourceType) => {
            dispatch({ type: "dragStart", sourceId, sourceType });
          },
          dispatchDragMove: (resolved) => {
            dispatch({ type: "dragMove", resolved });
          },
          dispatchDragEnd: () => {
            dispatch({ type: "dragEnd" });
          },
          commitResolvedDrop: async (drag) => {
            await moveNode(drag.sourceId, drag.sourceType, drag.resolved.target);
          },
          shouldCommitDrop: (drag) => drag.resolved.target !== drag.sourceId,
          resolveDropTarget,
        }}
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
    </>
  );
}
