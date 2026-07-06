import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";

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
  hasAuxiliary,
  layoutPreferences,
  resolvedLayout,
  setLayoutPreferences,
}: {
  hasAuxiliary: boolean;
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
      const startLayout = snapshotLayoutPreferences(
        layoutPreferences,
        resolvedLayout,
        hasAuxiliary,
      );

      setActiveResizeSide(side);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;

        setLayoutPreferences((value) => {
          if (side === "primary") {
            const nextPrimaryWidth = startLayout.primaryWidth + deltaX;
            const nextPrimaryVisible = nextPrimaryWidth >= CLOSE_SIDEBAR_THRESHOLD;

            return {
              ...value,
              priority: "primary",
              primaryVisible: nextPrimaryVisible,
              primaryWidth: normalizeSidebarWidth(nextPrimaryWidth, MIN_PRIMARY_WIDTH),
            };
          }

          const nextAuxiliaryWidth = startLayout.auxiliaryWidth - deltaX;
          const nextAuxiliaryVisible = nextAuxiliaryWidth >= CLOSE_SIDEBAR_THRESHOLD;

          return {
            ...value,
            priority: "auxiliary",
            auxiliaryVisible: nextAuxiliaryVisible,
            auxiliaryWidth: normalizeSidebarWidth(nextAuxiliaryWidth, MIN_AUXILIARY_WIDTH),
          };
        });
      };

      const cleanup = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", cleanup);
        window.removeEventListener("pointercancel", cleanup);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setActiveResizeSide(null);
        dragCleanupRef.current = null;
      };

      dragCleanupRef.current = cleanup;
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", cleanup, { once: true });
      window.addEventListener("pointercancel", cleanup, { once: true });
    },
    [hasAuxiliary, layoutPreferences, resolvedLayout, setLayoutPreferences],
  );

  return {
    activeResizeSide,
    startResizeDrag,
  };
}
