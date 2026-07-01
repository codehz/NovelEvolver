import { useCallback, useRef } from "react";
import type { PointerEventHandler } from "react";

import { resolveDropTargetFromRow } from "./drag-hit-test";

/** 拖动识别阈值（px）：位移超过此值才从"按下"进入"拖动中"。 */
const DRAG_THRESHOLD = 4;

type UseTreeRowPointerDragOptions = {
  disabled: boolean;
  sourcePath: string | null;
  sourceType: "file" | "folder";
  onActivate: (path: string, type: "file" | "folder") => void;
  onDragStart: (sourcePath: string, sourceType: "file" | "folder") => void;
  onDragMove: (targetPath: string | null) => void;
  onDragEnd: () => void;
};

type PointerStartState = {
  id: number;
  x: number;
  y: number;
  path: string;
  type: "file" | "folder";
};

function resolveTargetPathFromPointer(start: PointerStartState, clientX: number, clientY: number) {
  const target = document
    .elementFromPoint(clientX, clientY)
    ?.closest<HTMLElement>("[data-row-path]");
  if (target === null || target === undefined) {
    return "";
  }
  const targetPath = target.dataset.rowPath;
  const targetType = target.dataset.rowType;
  if (targetPath === undefined || targetType === undefined) {
    return "";
  }
  return resolveDropTargetFromRow(
    targetPath,
    targetType === "folder" ? "folder" : "file",
    start.path,
    start.type,
  );
}

export function useTreeRowPointerDrag({
  disabled,
  sourcePath,
  sourceType,
  onActivate,
  onDragStart,
  onDragMove,
  onDragEnd,
}: UseTreeRowPointerDragOptions): {
  onPointerDown: PointerEventHandler<HTMLButtonElement>;
  onPointerMove: PointerEventHandler<HTMLButtonElement>;
  onPointerUp: PointerEventHandler<HTMLButtonElement>;
  onPointerCancel: PointerEventHandler<HTMLButtonElement>;
} {
  const pointerStartRef = useRef<PointerStartState | null>(null);
  const draggingRef = useRef(false);

  const onPointerDown = useCallback<PointerEventHandler<HTMLButtonElement>>(
    (event) => {
      if (disabled || sourcePath === null) {
        return;
      }
      pointerStartRef.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        path: sourcePath,
        type: sourceType,
      };
      draggingRef.current = false;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [disabled, sourcePath, sourceType],
  );

  const onPointerMove = useCallback<PointerEventHandler<HTMLButtonElement>>(
    (event) => {
      const start = pointerStartRef.current;
      if (start === null || start.id !== event.pointerId) {
        return;
      }
      if (!draggingRef.current) {
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) {
          return;
        }
        draggingRef.current = true;
        onDragStart(start.path, start.type);
      }
      // setPointerCapture 使 pointermove 始终派发给源行，无法用事件接收者判断目标。
      // 用 elementFromPoint 找指针视觉所在行，读取其 data-row-path / data-row-type。
      onDragMove(resolveTargetPathFromPointer(start, event.clientX, event.clientY));
    },
    [onDragMove, onDragStart],
  );

  const onPointerUp = useCallback<PointerEventHandler<HTMLButtonElement>>(
    (event) => {
      const start = pointerStartRef.current;
      pointerStartRef.current = null;
      if (start === null || start.id !== event.pointerId) {
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
      onActivate(start.path, start.type);
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
