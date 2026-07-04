import { useCallback } from "react";

import type { TreeResolvedDrop } from "./tree-drag";

type UseTreeDragControllerOptions<
  RowType extends string,
  DropTarget,
  DragState extends { resolved: TreeResolvedDrop<DropTarget> | null },
> = {
  getCurrentDrag: () => DragState | null;
  dispatchDragStart: (sourceId: string, sourceType: RowType) => void;
  dispatchDragMove: (resolved: TreeResolvedDrop<DropTarget> | null) => void;
  dispatchDragEnd: () => void;
  commitResolvedDrop: (
    drag: DragState & { resolved: TreeResolvedDrop<DropTarget> },
  ) => void | Promise<void>;
  shouldCommitDrop?: (drag: DragState & { resolved: TreeResolvedDrop<DropTarget> }) => boolean;
};

export function useTreeDragController<
  RowType extends string,
  DropTarget,
  DragState extends { resolved: TreeResolvedDrop<DropTarget> | null },
>({
  getCurrentDrag,
  dispatchDragStart,
  dispatchDragMove,
  dispatchDragEnd,
  commitResolvedDrop,
  shouldCommitDrop,
}: UseTreeDragControllerOptions<RowType, DropTarget, DragState>) {
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

    const resolvedDrag = currentDrag as DragState & {
      resolved: TreeResolvedDrop<DropTarget>;
    };
    if (shouldCommitDrop !== undefined && !shouldCommitDrop(resolvedDrag)) {
      return;
    }

    void commitResolvedDrop(resolvedDrag);
  }, [commitResolvedDrop, dispatchDragEnd, getCurrentDrag, shouldCommitDrop]);

  return {
    handleDragStart,
    handleDragMove,
    handleCancelDrag,
    handleDragEnd,
  };
}
