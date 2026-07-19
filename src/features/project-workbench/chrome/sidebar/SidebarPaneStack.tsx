import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { cn } from "#app/shared/lib/ui/cn";

import {
  applyResizeDelta,
  resolveAvailableBodyHeight,
  resolveDisplayHeights,
  SIDEBAR_SECTION_HEADER_HEIGHT_PX,
  sum,
  type SidebarPaneGeometryInput,
} from "./sidebar-pane-geometry";
import { SidebarSectionRowResizeHandle, SidebarViewSection } from "./SidebarViewSection";

type SidebarPaneStackPane = SidebarPaneGeometryInput;

export type SidebarPaneStackItem = SidebarPaneStackPane & {
  title: string;
  ariaLabel: string;
  panelId: string;
  body: ReactNode;
  onToggleExpanded: () => void;
};

export type SidebarPaneStackProps = {
  panes: SidebarPaneStackItem[];
  className?: string;
};

function useSidebarPaneStack({ panes }: { panes: SidebarPaneStackPane[] }) {
  const [containerHeight, setContainerHeight] = useState(
    panes.length * SIDEBAR_SECTION_HEADER_HEIGHT_PX +
      sum(panes.filter((pane) => pane.expanded).map((pane) => pane.defaultBodyHeight)),
  );
  const [preferredHeights, setPreferredHeights] = useState<Record<string, number>>(() =>
    Object.fromEntries(panes.map((pane) => [pane.id, pane.defaultBodyHeight])),
  );
  const [activeResizeHandleId, setActiveResizeHandleId] = useState<string | null>(null);
  const stackRef = useRef<HTMLDivElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setPreferredHeights((current) => {
      let changed = false;
      const next = { ...current };

      for (const pane of panes) {
        if (pane.id in next) {
          continue;
        }

        next[pane.id] = pane.defaultBodyHeight;
        changed = true;
      }

      return changed ? next : current;
    });
  }, [panes]);

  useEffect(() => {
    const stack = stackRef.current;
    if (!stack) {
      return;
    }

    setContainerHeight(Math.round(stack.getBoundingClientRect().height));

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setContainerHeight(Math.round(entry.contentRect.height));
    });

    observer.observe(stack);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  const expandedPanes = useMemo(() => panes.filter((pane) => pane.expanded), [panes]);
  const availableBodyHeight = resolveAvailableBodyHeight(
    containerHeight,
    panes.length,
    expandedPanes.length,
  );
  const { effectiveMinHeights, resolvedHeights, displayHeights } = useMemo(
    () => resolveDisplayHeights(panes, preferredHeights, availableBodyHeight),
    [availableBodyHeight, panes, preferredHeights],
  );

  const resizeHandles = useMemo(
    () =>
      expandedPanes.slice(1).map((pane, paneIndex) => {
        const upperPaneId = expandedPanes[paneIndex]!.id;
        const upperPaneIndex = panes.findIndex((candidate) => candidate.id === upperPaneId);
        const anchorPaneId = panes[upperPaneIndex + 1]?.id ?? pane.id;

        return {
          id: pane.id,
          anchorPaneId,
          lowerPaneId: pane.id,
          upperPaneId,
        };
      }),
    [expandedPanes, panes],
  );

  const getResizeHandleProps = useCallback(
    (handleId: string) => ({
      active: activeResizeHandleId === handleId,
      onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
          return;
        }

        const handleIndex = resizeHandles.findIndex((handle) => handle.id === handleId);
        if (handleIndex < 0) {
          return;
        }

        event.preventDefault();
        dragCleanupRef.current?.();

        const startY = event.clientY;
        const startPaneIds = expandedPanes.map((pane) => pane.id);
        const startHeights = [...resolvedHeights];
        const startMinHeights = [...effectiveMinHeights];

        setActiveResizeHandleId(handleId);
        document.body.style.cursor = "row-resize";
        document.body.style.userSelect = "none";

        const handlePointerMove = (moveEvent: PointerEvent) => {
          const delta = Math.round(moveEvent.clientY - startY);
          const nextHeights = applyResizeDelta(startHeights, startMinHeights, handleIndex, delta);

          setPreferredHeights((current) => {
            const next = { ...current };

            startPaneIds.forEach((paneId, paneIndex) => {
              next[paneId] = nextHeights[paneIndex]!;
            });

            return next;
          });
        };

        const cleanup = () => {
          window.removeEventListener("pointermove", handlePointerMove);
          window.removeEventListener("pointerup", cleanup);
          window.removeEventListener("pointercancel", cleanup);
          document.body.style.cursor = "";
          document.body.style.userSelect = "";
          setActiveResizeHandleId(null);
          dragCleanupRef.current = null;
        };

        dragCleanupRef.current = cleanup;
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", cleanup, { once: true });
        window.addEventListener("pointercancel", cleanup, { once: true });
      },
    }),
    [activeResizeHandleId, effectiveMinHeights, expandedPanes, resizeHandles, resolvedHeights],
  );

  return {
    stackRef,
    displayHeights,
    resizeHandles,
    getResizeHandleProps,
  };
}

export function SidebarPaneStack({ panes, className }: SidebarPaneStackProps) {
  const { stackRef, displayHeights, resizeHandles, getResizeHandleProps } = useSidebarPaneStack({
    panes,
  });
  const paneTitleMap = useMemo(
    () => Object.fromEntries(panes.map((pane) => [pane.id, pane.title])),
    [panes],
  );

  return (
    <div ref={stackRef} className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      {panes.map((pane) => {
        const resizeHandle = resizeHandles.find((handle) => handle.anchorPaneId === pane.id);
        const resizeHandleProps = resizeHandle ? getResizeHandleProps(resizeHandle.id) : null;

        return (
          <Fragment key={pane.id}>
            {resizeHandle && resizeHandleProps ? (
              <SidebarSectionRowResizeHandle
                active={resizeHandleProps.active}
                ariaLabel={`调整${paneTitleMap[resizeHandle.upperPaneId]}与${pane.title}区域高度`}
                onPointerDown={resizeHandleProps.onPointerDown}
              />
            ) : null}
            <SidebarViewSection
              ariaLabel={pane.ariaLabel}
              bodyHeight={displayHeights[pane.id] ?? 0}
              expanded={pane.expanded}
              panelId={pane.panelId}
              title={pane.title}
              onToggleExpanded={pane.onToggleExpanded}
            >
              {pane.body}
            </SidebarViewSection>
          </Fragment>
        );
      })}
    </div>
  );
}
