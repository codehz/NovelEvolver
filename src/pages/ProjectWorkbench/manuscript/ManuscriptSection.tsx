import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useMemo } from "react";

import {
  SidebarHeaderActionButton,
  SidebarSectionActionsPortalContent,
} from "#app/components/workbench";

import { FlatTreeList } from "../tree/FlatTreeList";
import { TREE_ROW_HEIGHT_PX } from "../tree/tree-row-motion";
import { ManuscriptTreeRow } from "./ManuscriptTreeRow";
import { manuscriptTreeMolecule } from "./state/manuscript-tree-molecule";
import type { ManuscriptEditingState } from "./state/types";
import { useManuscriptTreeActions } from "./state/use-manuscript-tree-actions";
import { useManuscriptTreeSync } from "./state/use-manuscript-tree-sync";

type ManuscriptRenderItem = {
  id: string | null;
  title: string;
  type: "folder" | "chapter";
  depth: number;
  expanded: boolean;
  key: string;
  editing: ManuscriptEditingState | null;
};

export function ManuscriptSectionBody() {
  useManuscriptTreeSync();
  const { treeAtom, flatItemsAtom } = useMolecule(manuscriptTreeMolecule);
  const state = useAtomValue(treeAtom);
  const flatItems = useAtomValue(flatItemsAtom);
  const dispatch = useSetAtom(treeAtom);
  const store = useStore();
  const {
    startCreating,
    startRenaming,
    cancelEditing,
    submitEditing,
    activateNode,
    deleteNode,
    moveNode,
  } = useManuscriptTreeActions();

  const renderItems = useMemo(() => {
    const items: ManuscriptRenderItem[] = flatItems.map((item) => ({
      ...item,
      key: item.id,
      editing:
        state.editing?.mode === "renaming" && state.editing.id === item.id ? state.editing : null,
    }));
    const editing = state.editing;
    if (editing?.mode === "creating") {
      const parentIndex = flatItems.findIndex((item) => item.id === editing.parentId);
      const parentDepth = parentIndex >= 0 ? flatItems[parentIndex].depth : -1;
      const insertAt = parentIndex >= 0 ? parentIndex + 1 : flatItems.length;
      items.splice(insertAt, 0, {
        id: null,
        title: "",
        type: editing.kind,
        depth: parentDepth + 1,
        expanded: false,
        key: `creating-${editing.id}`,
        editing,
      });
    }
    return items;
  }, [flatItems, state.editing]);
  const isRootDropTarget = state.drag !== null && state.drag.targetParentId === "root";

  return (
    <>
      <SidebarSectionActionsPortalContent>
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
      </SidebarSectionActionsPortalContent>
      {state.status === "loading" || state.status === "idle" ? (
        <p className="px-2 py-1 text-xs text-ctp-subtext0">加载正文…</p>
      ) : state.status === "error" ? (
        <p className="px-2 py-1 text-xs text-ctp-red" role="alert">
          {state.error}
        </p>
      ) : renderItems.length === 0 ? (
        <p className="px-2 py-1 text-xs text-ctp-subtext0">正文为空。</p>
      ) : (
        <FlatTreeList
          items={renderItems}
          getItemKey={(item) => item.key}
          rootDropTarget={isRootDropTarget}
          dragging={state.drag !== null}
          rowHeight={TREE_ROW_HEIGHT_PX}
          onRequestRename={startRenaming}
          onRequestDelete={deleteNode}
          onCancelDrag={() => {
            dispatch({ type: "dragEnd" });
          }}
          renderRow={(item, _index, layout) => (
            <ManuscriptTreeRow
              id={item.id}
              title={item.title}
              type={item.type}
              depth={item.depth}
              expanded={item.expanded}
              animateEnter={layout.animateEnter}
              y={layout.y}
              height={layout.height}
              selected={item.id !== null && item.id === state.selectedId}
              editing={item.editing}
              drag={state.drag}
              onActivate={activateNode}
              onCancelEditing={cancelEditing}
              onSubmitEditing={submitEditing}
              onDragStart={(id, type) => {
                dispatch({ type: "dragStart", sourceId: id, sourceType: type });
              }}
              onDragMove={(targetParentId) => {
                dispatch({ type: "dragMove", targetParentId });
              }}
              onDragEnd={() => {
                const drag = store.get(treeAtom).drag;
                dispatch({ type: "dragEnd" });
                if (drag?.targetParentId) {
                  void moveNode(drag.sourceId, drag.targetParentId);
                }
              }}
            />
          )}
        />
      )}
    </>
  );
}
