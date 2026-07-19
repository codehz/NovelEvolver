import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";

import { beginPointerDragSession } from "../pointer-drag-session";
import {
  CLOSE_SIDEBAR_THRESHOLD,
  MIN_AUXILIARY_WIDTH,
  MIN_PRIMARY_WIDTH,
  normalizeSidebarWidth,
  snapshotLayoutPreferences,
  type LayoutPreferences,
  type ResizePriority,
  type ResolvedWorkbenchLayout,
} from "./workbench-layout-resolver";

export type ResizeSide = ResizePriority;

export function useWorkbenchSidebarResize({
  layoutPreferences,
  resolvedLayout,
  setLayoutPreferences,
}: {
  layoutPreferences: LayoutPreferences;
  resolvedLayout: ResolvedWorkbenchLayout;
  setLayoutPreferences: Dispatch<SetStateAction<LayoutPreferences>>;
}) {
  const [activeResizeSide, setActiveResizeSide] = useState<ResizeSide | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  const startResizeDrag = useCallback(
    (side: ResizeSide, event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      dragCleanupRef.current?.();

      const startX = event.clientX;
      const startLayout = snapshotLayoutPreferences(layoutPreferences, resolvedLayout);
      let pendingDeltaX = 0;
      let animationFrameId: number | null = null;

      const applyPendingResize = () => {
        animationFrameId = null;
        const deltaX = pendingDeltaX;

        setLayoutPreferences((value) => {
          if (side === "primary") {
            const nextPrimaryWidth = startLayout.primaryWidth + deltaX;
            const nextPrimaryVisible = nextPrimaryWidth >= CLOSE_SIDEBAR_THRESHOLD;
            const normalizedPrimaryWidth = normalizeSidebarWidth(
              nextPrimaryWidth,
              MIN_PRIMARY_WIDTH,
            );

            if (
              value.priority === "primary" &&
              value.primaryVisible === nextPrimaryVisible &&
              value.primaryWidth === normalizedPrimaryWidth
            ) {
              return value;
            }

            return {
              ...value,
              priority: "primary",
              primaryVisible: nextPrimaryVisible,
              primaryWidth: normalizedPrimaryWidth,
            };
          }

          const nextAuxiliaryWidth = startLayout.auxiliaryWidth - deltaX;
          const nextAuxiliaryVisible = nextAuxiliaryWidth >= CLOSE_SIDEBAR_THRESHOLD;
          const normalizedAuxiliaryWidth = normalizeSidebarWidth(
            nextAuxiliaryWidth,
            MIN_AUXILIARY_WIDTH,
          );

          if (
            value.priority === "auxiliary" &&
            value.auxiliaryVisible === nextAuxiliaryVisible &&
            value.auxiliaryWidth === normalizedAuxiliaryWidth
          ) {
            return value;
          }

          return {
            ...value,
            priority: "auxiliary",
            auxiliaryVisible: nextAuxiliaryVisible,
            auxiliaryWidth: normalizedAuxiliaryWidth,
          };
        });
      };

      setActiveResizeSide(side);

      dragCleanupRef.current = beginPointerDragSession({
        cursor: "col-resize",
        onMove: (moveEvent) => {
          pendingDeltaX = moveEvent.clientX - startX;

          if (animationFrameId !== null) {
            return;
          }

          animationFrameId = window.requestAnimationFrame(applyPendingResize);
        },
        onEnd: () => {
          if (animationFrameId !== null) {
            window.cancelAnimationFrame(animationFrameId);
            applyPendingResize();
          }

          setActiveResizeSide(null);
          dragCleanupRef.current = null;
        },
      });
    },
    [layoutPreferences, resolvedLayout, setLayoutPreferences],
  );

  return {
    activeResizeSide,
    startResizeDrag,
  };
}
