import { useCallback, useRef } from "react";
import type { ReactNode, RefObject } from "react";

import { FlatTreeList } from "./FlatTreeList";
import type { TreeResolvedDrop } from "./tree-drag";
import type { TreeRowLayout } from "./tree-row-layout";
import { TREE_ROW_HEIGHT_PX } from "./tree-row-motion";
import type { TreeDropResolveInput } from "./use-tree-row-pointer-drag";

export type TreeBodyStatus = "idle" | "loading" | "ready" | "error";

export type TreeBodyDragSession<RowType extends string, DropTarget> = {
  sourceId: string;
  sourceType: RowType;
  resolved: TreeResolvedDrop<DropTarget> | null;
};

export type TreeBodyRowLayout = TreeRowLayout;

export type TreeBodyRenderRowArgs<TItem, RowType extends string, DropTarget> = {
  item: TItem;
  index: number;
  layout: TreeBodyRowLayout;
  listRef: RefObject<HTMLUListElement | null>;
  dragging: boolean;
  resolveDropTarget: (input: TreeDropResolveInput<RowType>) => TreeResolvedDrop<DropTarget> | null;
  onDragStart: (sourceId: string, sourceType: RowType) => void;
  onDragMove: (resolved: TreeResolvedDrop<DropTarget> | null) => void;
  onDragEnd: () => void;
};

export type TreeBodyDragController<RowType extends string, DropTarget> = {
  getCurrentDrag: () => TreeBodyDragSession<RowType, DropTarget> | null;
  dispatchDragStart: (sourceId: string, sourceType: RowType) => void;
  dispatchDragMove: (resolved: TreeResolvedDrop<DropTarget> | null) => void;
  dispatchDragEnd: () => void;
  commitResolvedDrop: (
    drag: TreeBodyDragSession<RowType, DropTarget> & {
      resolved: TreeResolvedDrop<DropTarget>;
    },
  ) => void | Promise<void>;
  resolveDropTarget: (input: TreeDropResolveInput<RowType>) => TreeResolvedDrop<DropTarget> | null;
  shouldCommitDrop?: (
    drag: TreeBodyDragSession<RowType, DropTarget> & {
      resolved: TreeResolvedDrop<DropTarget>;
    },
  ) => boolean;
};

type TreeBodyProps<TItem, RowType extends string = string, DropTarget = never> = {
  status: TreeBodyStatus;
  isEmpty: boolean;
  items: readonly TItem[];
  getItemKey: (item: TItem) => string;
  renderRow: (args: TreeBodyRenderRowArgs<TItem, RowType, DropTarget>) => ReactNode;
  idleContent?: ReactNode;
  loadingContent?: ReactNode;
  errorContent?: ReactNode;
  emptyContent?: ReactNode;
  dragController?: TreeBodyDragController<RowType, DropTarget>;
  dropPreview?: TreeResolvedDrop<DropTarget>["preview"] | null;
  dragging?: boolean;
  rowHeight?: number;
  listRef?: RefObject<HTMLUListElement | null>;
  className?: string;
  onRequestRename?: () => void;
  onRequestDelete?: () => void | Promise<void>;
};

export function TreeBody<TItem, RowType extends string = string, DropTarget = never>({
  status,
  isEmpty,
  items,
  getItemKey,
  renderRow,
  idleContent = null,
  loadingContent = null,
  errorContent = null,
  emptyContent = null,
  dragController,
  dropPreview = null,
  dragging = false,
  rowHeight = TREE_ROW_HEIGHT_PX,
  listRef: providedListRef,
  className,
  onRequestRename,
  onRequestDelete,
}: TreeBodyProps<TItem, RowType, DropTarget>) {
  const fallbackListRef = useRef<HTMLUListElement>(null);
  const listRef = providedListRef ?? fallbackListRef;

  const handleDragStart = useCallback(
    (sourceId: string, sourceType: RowType) => {
      dragController?.dispatchDragStart(sourceId, sourceType);
    },
    [dragController],
  );

  const handleDragMove = useCallback(
    (resolved: TreeResolvedDrop<DropTarget> | null) => {
      dragController?.dispatchDragMove(resolved);
    },
    [dragController],
  );

  const handleCancelDrag = useCallback(() => {
    dragController?.dispatchDragEnd();
  }, [dragController]);

  const handleDragEnd = useCallback(() => {
    const currentDrag = dragController?.getCurrentDrag();
    dragController?.dispatchDragEnd();
    if (dragController === undefined || currentDrag == null || currentDrag.resolved === null) {
      return;
    }

    const resolvedDrag = currentDrag as TreeBodyDragSession<RowType, DropTarget> & {
      resolved: TreeResolvedDrop<DropTarget>;
    };
    if (
      dragController.shouldCommitDrop !== undefined &&
      !dragController.shouldCommitDrop(resolvedDrag)
    ) {
      return;
    }

    void dragController.commitResolvedDrop(resolvedDrag);
  }, [dragController]);

  const resolveDropTarget = useCallback(
    (input: TreeDropResolveInput<RowType>) => dragController?.resolveDropTarget(input) ?? null,
    [dragController],
  );

  if (status === "idle") {
    return idleContent;
  }
  if (status === "loading") {
    return loadingContent;
  }
  if (status === "error") {
    return errorContent;
  }
  if (isEmpty) {
    return emptyContent;
  }

  return (
    <FlatTreeList
      items={items}
      getItemKey={getItemKey}
      listRef={listRef}
      className={className}
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
