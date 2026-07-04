import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useMemo } from "react";

import { SidebarHeaderActionButton } from "#app/components/workbench";
import type { ManuscriptNode } from "#shared/rpc/projects-rpc";

import type { TreePaneProps } from "../tree/TreePane";
import type { TreeDropResolveInput } from "../tree/use-tree-row-pointer-drag";
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

export function useManuscriptTreePane(): TreePaneProps<
  ManuscriptRenderItem,
  ManuscriptNode["type"],
  ManuscriptMoveTarget
> {
  useManuscriptTreeSync();
  const { treeAtom } = useMolecule(manuscriptTreeMolecule);
  const state = useAtomValue(treeAtom);
  const dispatch = useSetAtom(treeAtom);
  const store = useStore();
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

  const resolveDropTarget = useCallback(
    (input: TreeDropResolveInput<ManuscriptNode["type"]>) => {
      const outline = store.get(treeAtom).outline;
      if (outline === null) {
        return null;
      }
      return resolveManuscriptDropTarget({
        outline,
        projection,
        ...input,
      });
    },
    [projection, store, treeAtom],
  );

  return {
    headerActions: (
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
    ),
    status: state.status,
    error: state.error,
    isEmpty: projection.items.length === 0,
    loadingLabel: "加载正文…",
    emptyLabel: "正文为空。",
    items: projection.items,
    getItemKey: (item) => item.key,
    dropPreview: state.drag?.resolved?.preview ?? null,
    dragging: state.drag !== null,
    onRequestRename: startRenaming,
    onRequestDelete: deleteNode,
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
      await moveNode(drag.sourceId, drag.resolved.target.parentId, drag.resolved.target.index);
    },
    resolveDropTarget,
    renderRow: ({
      item,
      index,
      layout,
      listRef,
      dragging,
      resolveDropTarget,
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
        resolveDropTarget={resolveDropTarget}
        onActivate={activateNode}
        onCancelEditing={cancelEditing}
        onSubmitEditing={submitEditing}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
      />
    ),
  };
}
