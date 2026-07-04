import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useMemo, useRef } from "react";

import {
  SidebarHeaderActionButton,
  SidebarSectionActionsPortalContent,
} from "#app/components/workbench";
import type { ManuscriptNode, ManuscriptOutline } from "#shared/rpc/projects-rpc";

import { FlatTreeList } from "../tree/FlatTreeList";
import type { TreeResolvedDrop, TreeRowHoverZone } from "../tree/tree-drag";
import type { TreeRowDomData } from "../tree/tree-row-dom";
import { buildSubtreeEndIndexArray, buildTreeRowIndexMap } from "../tree/tree-row-helpers";
import { TREE_DROP_INDICATOR_HEIGHT_PX, TREE_ROW_HEIGHT_PX } from "../tree/tree-row-motion";
import {
  findManuscriptChildIndex,
  findManuscriptParentId,
  getManuscriptNodeDepth,
} from "./manuscript-tree";
import { ManuscriptTreeRow } from "./ManuscriptTreeRow";
import { manuscriptTreeMolecule } from "./state/manuscript-tree-molecule";
import type { ManuscriptEditingState, ManuscriptMoveTarget } from "./state/types";
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

function resolveCreatingRenderPosition(
  items: ManuscriptRenderItem[],
  rowIndexById: Map<string, number>,
  subtreeEndIndexes: readonly number[],
  editing: Extract<ManuscriptEditingState, { mode: "creating" }>,
  outline: ManuscriptOutline,
): { insertAt: number; depth: number } {
  const parent = outline.nodes[editing.parentId];
  if (parent?.type !== "folder") {
    return { insertAt: items.length, depth: 0 };
  }

  const parentIndex = rowIndexById.get(editing.parentId) ?? -1;
  const parentDepth = editing.parentId === outline.rootId ? -1 : items[parentIndex]?.depth;
  const depth = parentDepth === undefined ? 0 : parentDepth + 1;
  const index = Math.max(0, Math.min(parent.children.length, Math.trunc(editing.index)));

  if (index === 0) {
    return { insertAt: parentIndex >= 0 ? parentIndex + 1 : 0, depth };
  }

  const previousSiblingId = parent.children[index - 1];
  const previousSiblingIndex = rowIndexById.get(previousSiblingId) ?? -1;
  if (previousSiblingIndex < 0) {
    return { insertAt: items.length, depth };
  }

  const previousSiblingEndIndex = subtreeEndIndexes[previousSiblingIndex];
  return { insertAt: (previousSiblingEndIndex ?? previousSiblingIndex) + 1, depth };
}

export function ManuscriptSectionBody() {
  useManuscriptTreeSync();
  const { treeAtom, flatItemsAtom } = useMolecule(manuscriptTreeMolecule);
  const state = useAtomValue(treeAtom);
  const flatItems = useAtomValue(flatItemsAtom);
  const dispatch = useSetAtom(treeAtom);
  const store = useStore();
  const listRef = useRef<HTMLUListElement>(null);
  const {
    startCreating,
    startRenaming,
    cancelEditing,
    submitEditing,
    activateNode,
    deleteNode,
    moveNode,
  } = useManuscriptTreeActions();
  const rowIndexById = useMemo(
    () => buildTreeRowIndexMap(flatItems, (item) => item.id),
    [flatItems],
  );
  const flatSubtreeEndIndexes = useMemo(() => buildSubtreeEndIndexArray(flatItems), [flatItems]);

  const renderItems = useMemo(() => {
    const items: ManuscriptRenderItem[] = flatItems.map((item) => ({
      ...item,
      key: item.id,
      editing:
        state.editing?.mode === "renaming" && state.editing.id === item.id ? state.editing : null,
    }));
    const editing = state.editing;
    if (editing?.mode === "creating") {
      const position =
        state.outline === null
          ? { insertAt: items.length, depth: 0 }
          : resolveCreatingRenderPosition(
              items,
              rowIndexById,
              flatSubtreeEndIndexes,
              editing,
              state.outline,
            );
      items.splice(position.insertAt, 0, {
        id: null,
        title: "",
        type: editing.kind,
        depth: position.depth,
        expanded: false,
        key: `creating-${editing.id}`,
        editing,
      });
    }
    return items;
  }, [flatItems, flatSubtreeEndIndexes, rowIndexById, state.editing, state.outline]);
  const renderIndexById = useMemo(
    () => buildTreeRowIndexMap(renderItems, (item) => item.id),
    [renderItems],
  );
  const renderSubtreeEndIndexes = useMemo(
    () => buildSubtreeEndIndexArray(renderItems),
    [renderItems],
  );
  const resolveDropTarget = useCallback(
    ({
      start: _start,
      hoveredRow,
      hoverZone,
      listRect,
      clientX: _clientX,
      clientY,
    }: {
      start: { rowId: string; rowType: ManuscriptNode["type"] };
      hoveredRow: TreeRowDomData<ManuscriptNode["type"]> | null;
      hoverZone: TreeRowHoverZone | null;
      listRect: DOMRect | null;
      clientX: number;
      clientY: number;
    }): TreeResolvedDrop<ManuscriptMoveTarget> | null => {
      const outline = store.get(treeAtom).outline;
      if (outline === null) {
        return null;
      }
      const rootNode = outline.nodes[outline.rootId];
      if (rootNode?.type !== "folder") {
        return null;
      }

      const getInsertDepth = (parentId: string) => getManuscriptNodeDepth(outline, parentId) + 1;

      const createInsertPreview = (visualIndex: number, depth: number) => ({
        kind: "insert" as const,
        depth,
        top: visualIndex * TREE_ROW_HEIGHT_PX - TREE_DROP_INDICATOR_HEIGHT_PX / 2,
        height: TREE_DROP_INDICATOR_HEIGHT_PX,
      });

      const resolveInsert = (rowId: string, visualIndex: number, placeAfter: boolean) => {
        const parentId = findManuscriptParentId(outline, rowId);
        if (parentId === null) {
          return null;
        }
        const childIndex = findManuscriptChildIndex(outline, parentId, rowId);
        if (childIndex < 0) {
          return null;
        }
        return {
          preview: createInsertPreview(visualIndex, getInsertDepth(parentId)),
          target: {
            kind: "insert" as const,
            parentId,
            index: childIndex + (placeAfter ? 1 : 0),
          },
        };
      };

      const isExpandedFolderWithVisibleChildren = (rowIndex: number, folderId: string) => {
        const item = renderItems[rowIndex];
        return (
          item?.id === folderId &&
          item.type === "folder" &&
          item.expanded &&
          (renderSubtreeEndIndexes[rowIndex] ?? rowIndex) > rowIndex
        );
      };

      const resolveInto = (rowIndex: number, folderId: string) => {
        const visualIndex = isExpandedFolderWithVisibleChildren(rowIndex, folderId)
          ? (renderSubtreeEndIndexes[rowIndex] ?? rowIndex) + 1
          : rowIndex + 1;
        return {
          preview: createInsertPreview(visualIndex, getInsertDepth(folderId)),
          target: { kind: "into" as const, parentId: folderId },
        };
      };

      if (hoveredRow === null) {
        const rootIndex = listRect !== null && clientY <= listRect.top ? 0 : renderItems.length;
        return {
          preview: createInsertPreview(rootIndex, 0),
          target: {
            kind: "insert",
            parentId: outline.rootId,
            index: rootIndex === 0 ? 0 : rootNode.children.length,
          },
        };
      }

      const hoveredNode = outline.nodes[hoveredRow.rowId];
      if (hoveredNode === undefined || hoverZone === null) {
        return null;
      }
      const hoveredRowIndex = renderIndexById.get(hoveredNode.id) ?? hoveredRow.rowIndex;
      const effectiveZone =
        hoveredNode.type === "chapter" && hoverZone === "inside"
          ? clientY < hoveredRow.rect.top + hoveredRow.rect.height / 2
            ? "before"
            : "after"
          : hoverZone;

      if (effectiveZone === "inside") {
        return hoveredNode.type !== "folder" ? null : resolveInto(hoveredRowIndex, hoveredNode.id);
      }

      if (effectiveZone === "before") {
        return resolveInsert(hoveredNode.id, hoveredRowIndex, false);
      }

      if (
        hoveredNode.type === "folder" &&
        isExpandedFolderWithVisibleChildren(hoveredRowIndex, hoveredNode.id)
      ) {
        return {
          preview: createInsertPreview(hoveredRowIndex + 1, getInsertDepth(hoveredNode.id)),
          target: {
            kind: "insert",
            parentId: hoveredNode.id,
            index: 0,
          },
        };
      }

      const afterVisualIndex =
        hoveredNode.type === "folder"
          ? (renderSubtreeEndIndexes[hoveredRowIndex] ?? hoveredRowIndex) + 1
          : hoveredRowIndex + 1;
      return resolveInsert(hoveredNode.id, afterVisualIndex, true);
    },
    [renderIndexById, renderItems, renderSubtreeEndIndexes, store, treeAtom],
  );

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
          listRef={listRef}
          dropPreview={state.drag?.resolved?.preview ?? null}
          dragging={state.drag !== null}
          rowHeight={TREE_ROW_HEIGHT_PX}
          onRequestRename={startRenaming}
          onRequestDelete={deleteNode}
          onCancelDrag={() => {
            dispatch({ type: "dragEnd" });
          }}
          renderRow={(item, index, layout) => (
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
              dragging={state.drag !== null}
              listRef={listRef}
              resolveDropTarget={resolveDropTarget}
              onActivate={activateNode}
              onCancelEditing={cancelEditing}
              onSubmitEditing={submitEditing}
              onDragStart={(id, type) => {
                dispatch({ type: "dragStart", sourceId: id, sourceType: type });
              }}
              onDragMove={(resolved) => {
                dispatch({ type: "dragMove", resolved });
              }}
              onDragEnd={() => {
                const drag = store.get(treeAtom).drag;
                dispatch({ type: "dragEnd" });
                if (drag?.resolved?.target.kind === "into") {
                  void moveNode(drag.sourceId, drag.resolved.target.parentId);
                  return;
                }
                if (drag?.resolved?.target.kind === "insert") {
                  void moveNode(
                    drag.sourceId,
                    drag.resolved.target.parentId,
                    drag.resolved.target.index,
                  );
                }
              }}
            />
          )}
        />
      )}
    </>
  );
}
