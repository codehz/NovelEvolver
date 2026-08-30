/**
 * Window-level pointer drag session shared by chrome resizers
 * (dock column sash + pane row handle).
 *
 * Locks body cursor / user-select, routes move/up/cancel, and is idempotent
 * after the first dispose (listener, unmount, or pointer end).
 */
export function beginPointerDragSession({
  cursor,
  onMove,
  onEnd,
}: {
  cursor: string;
  onMove: (event: PointerEvent) => void;
  onEnd?: () => void;
}): () => void {
  let disposed = false;

  document.body.style.cursor = cursor;
  document.body.style.userSelect = "none";

  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", dispose);
    window.removeEventListener("pointercancel", dispose);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    onEnd?.();
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", dispose);
  window.addEventListener("pointercancel", dispose);

  return dispose;
}
