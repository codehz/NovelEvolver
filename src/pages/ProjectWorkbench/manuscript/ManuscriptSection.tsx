import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useMemo, useRef } from "react";

import { SidebarHeaderActionButton } from "#app/components/workbench";
import type { ManuscriptTreeNode } from "#shared/rpc/worktree-tree";

import { queryTreeRowById } from "../tree/tree-row-dom";
import { TreePane } from "../tree/TreePane";
import { useTreeRevealRequest } from "../tree/use-tree-reveal-request";
import type { TreeDropResolveInput } from "../tree/use-tree-row-pointer-drag";
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
  const { treeAtom, onRevealRequest } = useMolecule(manuscriptTreeMolecule);
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

  useTreeRevealRequest({
    onRevealRequest,
    retryDeps: [projection.items],
    reveal: (targetId) => {
      const snapshot = state.snapshot;
      if (snapshot === null) {
        return "retry";
      }
      const targetNode = snapshot.nodes[targetId];
      if (targetNode === undefined) {
        return "done";
      }

      if (targetId === snapshot.rootId) {
        listRef.current?.scrollIntoView({ block: "start" });
        dispatch({ type: "expand", id: snapshot.rootId });
        dispatch({ type: "select", id: snapshot.rootId });
        return "done";
      }

      const ancestorIds = manuscriptParentChain(snapshot, targetId)
        .map((node) => node.id)
        .slice(0, -1);
      for (const ancestorId of ancestorIds) {
        dispatch({ type: "expand", id: ancestorId });
      }

      const itemIndex = projection.rowIndexById.get(targetId);
      const item = itemIndex === undefined ? undefined : projection.items[itemIndex];
      if (item === undefined) {
        return "retry";
      }

      dispatch({ type: "select", id: targetId });
      const row = listRef.current ? queryTreeRowById(listRef.current, targetId) : null;
      row?.scrollIntoView({ block: "nearest" });
      return "done";
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
    <TreePane<ManuscriptRenderItem, ManuscriptTreeNode["type"], ManuscriptMoveTarget>
      listRef={listRef}
      headerActions={
        <>
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
        </>
      }
      status={state.status}
      error={state.error}
      isEmpty={projection.items.length === 0}
      loadingLabel="加载正文…"
      emptyLabel="正文为空。"
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
        if (drag.resolved.target.kind === "into") {
          await moveNode(drag.sourceId, drag.resolved.target.parentId);
          return;
        }
        await moveNode(drag.sourceId, drag.resolved.target.parentId, drag.resolved.target.index);
      }}
      resolveDropTarget={resolveDropTarget}
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
          animateEnter={layout.animateEnter}
          y={layout.y}
          height={layout.height}
          selected={item.id !== null && item.id === state.selectedId}
          editing={item.editing}
          dragging={dragging}
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
  );
}
