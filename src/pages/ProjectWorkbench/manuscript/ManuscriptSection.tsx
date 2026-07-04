import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { AnimatePresence } from "motion/react";
import { useLayoutEffect, useMemo, useRef } from "react";

import {
  SidebarHeaderActionButton,
  SidebarSectionActionsPortalContent,
} from "#app/components/workbench";
import { cn } from "#app/lib/cn";

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
  const hasLayoutRef = useRef(false);
  const previousKeysRef = useRef<Set<string>>(new Set());
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

  const enterKeySet = useMemo(() => {
    const next = new Set<string>();
    if (!hasLayoutRef.current) {
      return next;
    }
    for (const item of renderItems) {
      if (!previousKeysRef.current.has(item.key)) {
        next.add(item.key);
      }
    }
    return next;
  }, [renderItems]);

  useLayoutEffect(() => {
    hasLayoutRef.current = true;
    previousKeysRef.current = new Set(renderItems.map((item) => item.key));
  }, [renderItems]);

  const listHeight = renderItems.length * TREE_ROW_HEIGHT_PX;
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
        <ul
          className={cn("outline-none", isRootDropTarget && "bg-resource-drop-target")}
          role="tree"
          style={{ height: listHeight, position: "relative" }}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "F2") {
              event.preventDefault();
              startRenaming();
            } else if (event.key === "Delete") {
              event.preventDefault();
              void deleteNode();
            } else if (event.key === "Escape" && state.drag !== null) {
              event.preventDefault();
              dispatch({ type: "dragEnd" });
            }
          }}
        >
          <AnimatePresence initial={false}>
            {renderItems.map((item, index) => (
              <ManuscriptTreeRow
                key={item.key}
                id={item.id}
                title={item.title}
                type={item.type}
                depth={item.depth}
                expanded={item.expanded}
                animateEnter={enterKeySet.has(item.key)}
                y={index * TREE_ROW_HEIGHT_PX}
                height={TREE_ROW_HEIGHT_PX}
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
            ))}
          </AnimatePresence>
        </ul>
      )}
    </>
  );
}
