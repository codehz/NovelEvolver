import { useCallback, useRef } from "react";
import type { PointerEventHandler } from "react";

/** 拖动识别阈值（px）：位移超过此值才从"按下"进入"拖动中"。 */
const DRAG_THRESHOLD = 4;

type TreeRowPointerStartState<RowType extends string> = {
  pointerId: number;
  clientX: number;
  clientY: number;
  rowId: string;
  rowType: RowType;
};

type UseTreeRowPointerDragOptions<RowType extends string, DropTarget> = {
  disabled: boolean;
  dragSource: { rowId: string; rowType: RowType } | null;
  onActivate: () => void;
  onDragStart: () => void;
  onDragMove: (target: DropTarget | null) => void;
  onDragEnd: () => void;
  resolveDropTarget: (
    start: TreeRowPointerStartState<RowType>,
    clientX: number,
    clientY: number,
  ) => DropTarget | null;
};

export function useTreeRowPointerDrag<RowType extends string, DropTarget>({
  disabled,
  dragSource,
  onActivate,
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
      onDragMove(resolveDropTarget(start, event.clientX, event.clientY));
    },
    [onDragMove, onDragStart, resolveDropTarget],
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
      onActivate();
    },
    [onActivate, onDragEnd],
  );

  const onPointerCancel = useCallback<PointerEventHandler<HTMLButtonElement>>(
    (event) => {
      const start = pointerStartRef.current;
      pointerStartRef.current = null;
      draggingRef.current = false;
      if (start !== null && event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      onDragMove(null);
    },
    [onDragMove],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
