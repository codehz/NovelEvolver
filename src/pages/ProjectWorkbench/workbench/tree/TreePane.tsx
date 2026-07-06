import { useCallback, useRef } from "react";
import type { ReactNode, RefObject } from "react";

import { SidebarSectionActionsPortalContent } from "#app/components/workbench";

import { FlatTreeList } from "./FlatTreeList";
import type { TreeResolvedDrop } from "./tree-drag";
import type { TreeRowLayout } from "./tree-row-layout";
import { TREE_ROW_HEIGHT_PX } from "./tree-row-motion";
import type { TreeDropResolveInput } from "./use-tree-row-pointer-drag";

type TreePaneStatus = "idle" | "loading" | "ready" | "error";

export type TreePaneDragSession<RowType extends string, DropTarget> = {
  sourceId: string;
  sourceType: RowType;
  resolved: TreeResolvedDrop<DropTarget> | null;
};

export type TreePaneRowLayout = TreeRowLayout;

export type TreePaneRenderRowArgs<TItem, RowType extends string, DropTarget> = {
  item: TItem;
  index: number;
  layout: TreePaneRowLayout;
  listRef: RefObject<HTMLUListElement | null>;
  dragging: boolean;
  resolveDropTarget: (input: TreeDropResolveInput<RowType>) => TreeResolvedDrop<DropTarget> | null;
  onDragStart: (sourceId: string, sourceType: RowType) => void;
  onDragMove: (resolved: TreeResolvedDrop<DropTarget> | null) => void;
  onDragEnd: () => void;
};

export type TreePaneProps<TItem, RowType extends string, DropTarget> = {
  headerActions?: ReactNode;
  status: TreePaneStatus;
  error: string | null;
  isEmpty: boolean;
  loadingLabel: string;
  emptyLabel: string;
  items: readonly TItem[];
  getItemKey: (item: TItem) => string;
  renderRow: (args: TreePaneRenderRowArgs<TItem, RowType, DropTarget>) => ReactNode;
  getCurrentDrag: () => TreePaneDragSession<RowType, DropTarget> | null;
  dispatchDragStart: (sourceId: string, sourceType: RowType) => void;
  dispatchDragMove: (resolved: TreeResolvedDrop<DropTarget> | null) => void;
  dispatchDragEnd: () => void;
  commitResolvedDrop: (
    drag: TreePaneDragSession<RowType, DropTarget> & {
      resolved: TreeResolvedDrop<DropTarget>;
    },
  ) => void | Promise<void>;
  resolveDropTarget: (input: TreeDropResolveInput<RowType>) => TreeResolvedDrop<DropTarget> | null;
  dropPreview?: TreeResolvedDrop<DropTarget>["preview"] | null;
  dragging?: boolean;
  rowHeight?: number;
  listRef?: RefObject<HTMLUListElement | null>;
  onRequestRename?: () => void;
  onRequestDelete?: () => void | Promise<void>;
  shouldCommitDrop?: (
    drag: TreePaneDragSession<RowType, DropTarget> & {
      resolved: TreeResolvedDrop<DropTarget>;
    },
  ) => boolean;
};

export function TreePane<TItem, RowType extends string, DropTarget>({
  headerActions,
  status,
  error,
  isEmpty,
  loadingLabel,
  emptyLabel,
  items,
  getItemKey,
  renderRow,
  getCurrentDrag,
  dispatchDragStart,
  dispatchDragMove,
  dispatchDragEnd,
  commitResolvedDrop,
  resolveDropTarget,
  dropPreview = null,
  dragging = false,
  rowHeight = TREE_ROW_HEIGHT_PX,
  listRef: providedListRef,
  onRequestRename,
  onRequestDelete,
  shouldCommitDrop,
}: TreePaneProps<TItem, RowType, DropTarget>) {
  const fallbackListRef = useRef<HTMLUListElement>(null);
  const listRef = providedListRef ?? fallbackListRef;

  const handleDragStart = useCallback(
    (sourceId: string, sourceType: RowType) => {
      dispatchDragStart(sourceId, sourceType);
    },
    [dispatchDragStart],
  );

  const handleDragMove = useCallback(
    (resolved: TreeResolvedDrop<DropTarget> | null) => {
      dispatchDragMove(resolved);
    },
    [dispatchDragMove],
  );

  const handleCancelDrag = useCallback(() => {
    dispatchDragEnd();
  }, [dispatchDragEnd]);

  const handleDragEnd = useCallback(() => {
    const currentDrag = getCurrentDrag();
    dispatchDragEnd();
    if (currentDrag === null || currentDrag.resolved === null) {
      return;
    }

    const resolvedDrag = currentDrag as TreePaneDragSession<RowType, DropTarget> & {
      resolved: TreeResolvedDrop<DropTarget>;
    };
    if (shouldCommitDrop !== undefined && !shouldCommitDrop(resolvedDrag)) {
      return;
    }

    void commitResolvedDrop(resolvedDrag);
  }, [commitResolvedDrop, dispatchDragEnd, getCurrentDrag, shouldCommitDrop]);

  let content: ReactNode;
  if (status === "idle" || status === "loading") {
    content = <p className="px-2 py-1 text-xs text-ctp-subtext0">{loadingLabel}</p>;
  } else if (status === "error") {
    content = (
      <p className="px-2 py-1 text-xs text-ctp-red" role="alert">
        {error}
      </p>
    );
  } else if (isEmpty) {
    content = <p className="px-2 py-1 text-xs text-ctp-subtext0">{emptyLabel}</p>;
  } else {
    content = (
      <FlatTreeList
        items={items}
        getItemKey={getItemKey}
        listRef={listRef}
        dropPreview={dropPreview}
        dragging={dragging}
        rowHeight={rowHeight}
        onRequestRename={onRequestRename}
        onRequestDelete={onRequestDelete}
        onCancelDrag={handleCancelDrag}
        renderRow={(item, index, layout) =>
          renderRow({
            item,
            index,
            layout,
            listRef,
            dragging,
            resolveDropTarget,
            onDragStart: handleDragStart,
            onDragMove: handleDragMove,
            onDragEnd: handleDragEnd,
          })
        }
      />
    );
  }

  return (
    <>
      {headerActions ? (
        <SidebarSectionActionsPortalContent>{headerActions}</SidebarSectionActionsPortalContent>
      ) : null}
      {content}
    </>
  );
}
