import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useMemo, useRef } from "react";

import type { ManuscriptTreeNode } from "#shared/rpc/worktree-tree-rpc";
import { SidebarHeaderActionButton, SidebarHeaderActions } from "#workbench/chrome";

import { TreeBody } from "../../tree/TreeBody";
import type { TreeDropResolveInput } from "../../tree/use-tree-row-pointer-drag";
import { useContentTreeReveal } from "../shared/content-tree-reveal";
import { manuscriptParentChain } from "./manuscript-tree";
import { resolveManuscriptDropTarget } from "./manuscript-tree-placement-policy";
import {
  buildManuscriptRenderProjection,
  type ManuscriptRenderItem,
} from "./manuscript-tree-projector";
import { ManuscriptTreeRow } from "./ManuscriptTreeRow";
import { manuscriptTreeMolecule } from "./state/manuscript-tree-molecule";
import type { ManuscriptMoveTarget } from "./state/types";
import { useManuscriptTreeActions } from "./state/use-manuscript-tree-actions";
import { useManuscriptTreeSync } from "./state/use-manuscript-tree-sync";

export function ManuscriptSectionBody() {
  useManuscriptTreeSync();
  const { treeAtom, onRevealRequest, retryPendingReveal } = useMolecule(manuscriptTreeMolecule);
  const state = useAtomValue(treeAtom);
  const dispatch = useSetAtom(treeAtom);
  const store = useStore();
  const listRef = useRef<HTMLUListElement>(null);
  const projection = useMemo(() => buildManuscriptRenderProjection(state), [state]);
  const {
    startCreating,
    startRenaming,
    cancelEditing,
    submitEditing,
    activateNode,
    deleteNode,
    moveNode,
  } = useManuscriptTreeActions();

  useContentTreeReveal({
    snapshot: state.snapshot,
    projection,
    listRef,
    onRevealRequest,
    retryPendingReveal,
    handlers: {
      parentChain: manuscriptParentChain,
      revealRoot: (snapshot) => {
        dispatch({ type: "expand", id: snapshot.rootId });
        dispatch({ type: "select", id: snapshot.rootId });
      },
      expandAncestors: (ancestorIds) => {
        for (const ancestorId of ancestorIds) {
          dispatch({ type: "expand", id: ancestorId });
        }
      },
      selectTarget: (targetId) => {
        dispatch({ type: "select", id: targetId });
      },
    },
  });

  const resolveDropTarget = useCallback(
    (input: TreeDropResolveInput<ManuscriptTreeNode["type"]>) => {
      const snapshot = store.get(treeAtom).snapshot;
      if (snapshot === null) {
        return null;
      }
      return resolveManuscriptDropTarget({
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
          label="新建章节"
          icon="icon-[codicon--new-file]"
          onClick={() => startCreating("chapter")}
        />
        <SidebarHeaderActionButton
          label="新建文件夹"
          icon="icon-[codicon--new-folder]"
          onClick={() => startCreating("folder")}
        />
      </SidebarHeaderActions>
      <TreeBody<ManuscriptRenderItem, ManuscriptTreeNode["type"], ManuscriptMoveTarget>
        listRef={listRef}
        status={state.status}
        isEmpty={projection.items.length === 0}
        loadingContent={<p className="px-2 py-1 text-xs text-ctp-subtext0">加载正文…</p>}
        errorContent={
          state.error === null ? null : (
            <p className="px-2 py-1 text-xs text-ctp-red" role="alert">
              {state.error}
            </p>
          )
        }
        emptyContent={<p className="px-2 py-1 text-xs text-ctp-subtext0">正文为空。</p>}
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
            if (drag.resolved.target.kind === "into") {
              await moveNode(drag.sourceId, drag.resolved.target.parentId);
              return;
            }
            await moveNode(
              drag.sourceId,
              drag.resolved.target.parentId,
              drag.resolved.target.index,
            );
          },
          resolveDropTarget,
        }}
        renderRow={({
          item,
          index,
          layout,
          listRef,
          dragging,
          resolveDropTarget: resolveDrop,
          onDragStart,
          onDragMove,
          onDragEnd,
        }) => (
          <ManuscriptTreeRow
            id={item.id}
            title={item.title}
            type={item.type}
            depth={item.depth}
            expanded={item.expanded}
            index={index}
            layout={layout}
            selected={item.id !== null && item.id === state.selectedId}
            editing={item.editing}
            dragging={dragging}
            changeStatus={item.changeStatus}
            listRef={listRef}
            resolveDropTarget={resolveDrop}
            onActivate={activateNode}
            onCancelEditing={cancelEditing}
            onSubmitEditing={submitEditing}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
          />
        )}
      />
    </>
  );
}
