import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import {
  SIDEBAR_SECTION_HEADER_HEIGHT_PX,
  SIDEBAR_SECTION_RESIZE_STRIP_HEIGHT,
} from "./SidebarViewSection";

export const MIN_SIDEBAR_SECTION_BODY_HEIGHT = 72;

export function useSidebarSectionSplit({
  enabled,
  defaultTopBodyHeight,
}: {
  enabled: boolean;
  defaultTopBodyHeight: number;
}) {
  const [topBodyHeight, setTopBodyHeight] = useState(defaultTopBodyHeight);
  const [resizeActive, setResizeActive] = useState(false);
  const stackRef = useRef<HTMLDivElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled) {
        return;
      }

      event.preventDefault();
      const stack = stackRef.current;
      if (!stack) {
        return;
      }

      const startY = event.clientY;
      const startHeight = topBodyHeight;
      const stackHeight = stack.getBoundingClientRect().height;
      const maxTopBody = Math.max(
        MIN_SIDEBAR_SECTION_BODY_HEIGHT,
        stackHeight -
          2 * SIDEBAR_SECTION_HEADER_HEIGHT_PX -
          SIDEBAR_SECTION_RESIZE_STRIP_HEIGHT -
          MIN_SIDEBAR_SECTION_BODY_HEIGHT,
      );

      setResizeActive(true);

      const onPointerMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientY - startY;
        const next = Math.round(
          Math.min(maxTopBody, Math.max(MIN_SIDEBAR_SECTION_BODY_HEIGHT, startHeight + delta)),
        );
        setTopBodyHeight(next);
      };

      const onPointerUp = () => {
        setResizeActive(false);
        dragCleanupRef.current?.();
        dragCleanupRef.current = null;
      };

      dragCleanupRef.current?.();
      dragCleanupRef.current = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    },
    [enabled, topBodyHeight],
  );

  return {
    stackRef,
    topBodyHeight,
    resizeActive,
    onResizePointerDown,
  };
}