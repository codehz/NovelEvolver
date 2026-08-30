import { useCallback, useRef } from "react";
import type { PointerEventHandler, RefObject } from "react";

import type { TreeResolvedDrop, TreeRowHoverZone } from "./tree-drag";
import { resolveHoverZone } from "./tree-drag";
import type { TreeRowDomData } from "./tree-row-dom";
import { findTreeRowDataAtPoint } from "./tree-row-dom";

/** 拖动识别阈值（px）：位移超过此值才从"按下"进入"拖动中"。 */
const DRAG_THRESHOLD = 4;

export type TreeRowPointerStartState<RowType extends string> = {
  pointerId: number;
  clientX: number;
  clientY: number;
  rowId: string;
  rowType: RowType;
};

export type TreeDropResolveInput<RowType extends string> = {
  start: TreeRowPointerStartState<RowType>;
  hoveredRow: TreeRowDomData<RowType> | null;
  hoverZone: TreeRowHoverZone | null;
  listRect: DOMRect | null;
  clientX: number;
  clientY: number;
};

type UseTreeRowPointerDragOptions<RowType extends string, DropTarget> = {
  disabled: boolean;
  dragSource: { rowId: string; rowType: RowType } | null;
  listRef?: RefObject<HTMLElement | null>;
  onActivate: () => void;
  onDoubleActivate: () => void;
  onDragStart: () => void;
  onDragMove: (target: TreeResolvedDrop<DropTarget> | null) => void;
  onDragEnd: () => void;
  resolveDropTarget: (input: TreeDropResolveInput<RowType>) => TreeResolvedDrop<DropTarget> | null;
};

export function useTreeRowPointerDrag<RowType extends string, DropTarget>({
  disabled,
  dragSource,
  listRef,
  onActivate,
  onDoubleActivate,
  onDragStart,
  onDragMove,
  onDragEnd,
  resolveDropTarget,
}: UseTreeRowPointerDragOptions<RowType, DropTarget>): {
  onPointerDown: PointerEventHandler<HTMLButtonElement>;
  onPointerMove: PointerEventHandler<HTMLButtonElement>;
  onPointerUp: PointerEventHandler<HTMLButtonElement>;
  onPointerCancel: PointerEventHandler<HTMLButtonElement>;
} {
  const pointerStartRef = useRef<TreeRowPointerStartState<RowType> | null>(null);
  const draggingRef = useRef(false);

  const onPointerDown = useCallback<PointerEventHandler<HTMLButtonElement>>(
    (event) => {
      if (disabled || dragSource === null) {
        return;
      }
      pointerStartRef.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        rowId: dragSource.rowId,
        rowType: dragSource.rowType,
      };
      draggingRef.current = false;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [disabled, dragSource],
  );

  const onPointerMove = useCallback<PointerEventHandler<HTMLButtonElement>>(
    (event) => {
      const start = pointerStartRef.current;
      if (start === null || start.pointerId !== event.pointerId) {
        return;
      }
      if (!draggingRef.current) {
        const dx = event.clientX - start.clientX;
        const dy = event.clientY - start.clientY;
        if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) {
          return;
        }
        draggingRef.current = true;
        onDragStart();
      }
      const listElement = listRef?.current ?? null;
      const hoveredRow = findTreeRowDataAtPoint<RowType>(event.clientX, event.clientY, listElement);
      onDragMove(
        resolveDropTarget({
          start,
          hoveredRow,
          hoverZone: hoveredRow === null ? null : resolveHoverZone(event.clientY, hoveredRow.rect),
          listRect: listElement?.getBoundingClientRect() ?? null,
          clientX: event.clientX,
          clientY: event.clientY,
        }),
      );
    },
    [listRef, onDragMove, onDragStart, resolveDropTarget],
  );

  const onPointerUp = useCallback<PointerEventHandler<HTMLButtonElement>>(
    (event) => {
      const start = pointerStartRef.current;
      pointerStartRef.current = null;
      if (start === null || start.pointerId !== event.pointerId) {
        return;
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (draggingRef.current) {
        draggingRef.current = false;
        onDragEnd();
        return;
      }
      if (event.detail >= 2) {
        onDoubleActivate();
        return;
      }
      onActivate();
    },
    [onActivate, onDoubleActivate, onDragEnd],
  );

  const onPointerCancel = useCallback<PointerEventHandler<HTMLButtonElement>>(
    (event) => {
      const start = pointerStartRef.current;
      pointerStartRef.current = null;
      const wasDragging = draggingRef.current;
      draggingRef.current = false;
      if (
        start !== null &&
        start.pointerId === event.pointerId &&
        event.currentTarget.hasPointerCapture(event.pointerId)
      ) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      onDragMove(null);
      if (wasDragging) {
        onDragEnd();
      }
    },
    [onDragEnd, onDragMove],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
