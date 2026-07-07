import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { cn } from "#app/shared/lib/ui/cn";

import {
  SidebarSectionRowResizeHandle,
  SidebarViewSection,
  SIDEBAR_SECTION_HEADER_HEIGHT_PX,
  SIDEBAR_SECTION_RESIZE_STRIP_HEIGHT,
} from "./SidebarViewSection";

const MIN_SIDEBAR_SECTION_BODY_HEIGHT = 72;

type SidebarPaneStackPane = {
  id: string;
  expanded: boolean;
  defaultBodyHeight: number;
  minBodyHeight?: number;
};

type SidebarPaneStackLayout = {
  bodyFillsSection: boolean;
  bodyStyle?: CSSProperties;
  sectionStyle?: CSSProperties;
};

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

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function scaleHeightsToTotal(heights: number[], total: number) {
  if (heights.length === 0) {
    return [];
  }

  if (total <= 0) {
    return heights.map(() => 0);
  }

  const currentTotal = sum(heights);
  if (currentTotal <= 0) {
    const evenShare = Math.floor(total / heights.length);
    const remainder = total - evenShare * heights.length;
    return heights.map((_, index) => evenShare + (index < remainder ? 1 : 0));
  }

  const scaled = heights.map((height) => (height * total) / currentTotal);
  const floors = scaled.map((value) => Math.floor(value));
  let remaining = total - sum(floors);

  const indexesByFraction = scaled
    .map((value, index) => ({ index, fraction: value - floors[index]! }))
    .sort((left, right) => right.fraction - left.fraction);

  for (let index = 0; index < indexesByFraction.length && remaining > 0; index += 1) {
    floors[indexesByFraction[index]!.index] += 1;
    remaining -= 1;
  }

  return floors;
}

function resolveEffectiveMinHeights(panes: SidebarPaneStackPane[], availableBodyHeight: number) {
  const minHeights = panes.map((pane) =>
    Math.max(
      MIN_SIDEBAR_SECTION_BODY_HEIGHT,
      pane.minBodyHeight ?? MIN_SIDEBAR_SECTION_BODY_HEIGHT,
    ),
  );
  const totalMinHeight = sum(minHeights);

  if (totalMinHeight <= availableBodyHeight) {
    return minHeights;
  }

  return scaleHeightsToTotal(minHeights, availableBodyHeight);
}

function resolvePaneHeights(
  panes: SidebarPaneStackPane[],
  preferredHeights: Record<string, number>,
  availableBodyHeight: number,
) {
  if (panes.length === 0) {
    return {
      effectiveMinHeights: [] as number[],
      resolvedHeights: [] as number[],
    };
  }

  const effectiveMinHeights = resolveEffectiveMinHeights(panes, availableBodyHeight);

  if (panes.length === 1) {
    return {
      effectiveMinHeights,
      resolvedHeights: [Math.max(availableBodyHeight, 0)],
    };
  }

  let remainingBodyHeight = Math.max(availableBodyHeight, 0);
  const resolvedHeights = panes.map(() => 0);
  const minHeightSuffixSums = panes.map((_, paneIndex) =>
    sum(effectiveMinHeights.slice(paneIndex + 1)),
  );

  for (let paneIndex = 0; paneIndex < panes.length - 1; paneIndex += 1) {
    const pane = panes[paneIndex]!;
    const minHeight = effectiveMinHeights[paneIndex]!;
    const maxHeight = Math.max(minHeight, remainingBodyHeight - minHeightSuffixSums[paneIndex]!);
    const preferredHeight = Math.round(preferredHeights[pane.id] ?? pane.defaultBodyHeight);
    const resolvedHeight = Math.min(maxHeight, Math.max(minHeight, preferredHeight));

    resolvedHeights[paneIndex] = resolvedHeight;
    remainingBodyHeight -= resolvedHeight;
  }

  resolvedHeights[panes.length - 1] = Math.max(remainingBodyHeight, 0);

  return {
    effectiveMinHeights,
    resolvedHeights,
  };
}

function applyResizeDelta(
  heights: number[],
  minHeights: number[],
  handleIndex: number,
  delta: number,
) {
  if (delta === 0) {
    return heights;
  }

  const nextHeights = [...heights];

  if (delta > 0) {
    const shrinkCapacity = sum(
      nextHeights.slice(handleIndex + 1).map((height, paneIndex) => {
        const minHeight = minHeights[handleIndex + 1 + paneIndex]!;
        return Math.max(height - minHeight, 0);
      }),
    );
    let remainingDelta = Math.min(delta, shrinkCapacity);

    nextHeights[handleIndex] += remainingDelta;

    for (
      let paneIndex = handleIndex + 1;
      paneIndex < nextHeights.length && remainingDelta > 0;
      paneIndex += 1
    ) {
      const shrinkAmount = Math.min(
        Math.max(nextHeights[paneIndex]! - minHeights[paneIndex]!, 0),
        remainingDelta,
      );
      nextHeights[paneIndex] -= shrinkAmount;
      remainingDelta -= shrinkAmount;
    }

    return nextHeights;
  }

  const growth = Math.abs(delta);
  const shrinkCapacity = sum(
    nextHeights
      .slice(0, handleIndex + 1)
      .map((height, paneIndex) => Math.max(height - minHeights[paneIndex]!, 0)),
  );
  let remainingDelta = Math.min(growth, shrinkCapacity);

  nextHeights[handleIndex + 1] += remainingDelta;

  for (let paneIndex = handleIndex; paneIndex >= 0 && remainingDelta > 0; paneIndex -= 1) {
    const shrinkAmount = Math.min(
      Math.max(nextHeights[paneIndex]! - minHeights[paneIndex]!, 0),
      remainingDelta,
    );
    nextHeights[paneIndex] -= shrinkAmount;
    remainingDelta -= shrinkAmount;
  }

  return nextHeights;
}

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
  const availableBodyHeight = Math.max(
    containerHeight -
      panes.length * SIDEBAR_SECTION_HEADER_HEIGHT_PX -
      Math.max(expandedPanes.length - 1, 0) * SIDEBAR_SECTION_RESIZE_STRIP_HEIGHT,
    0,
  );
  const { effectiveMinHeights, resolvedHeights } = useMemo(
    () => resolvePaneHeights(expandedPanes, preferredHeights, availableBodyHeight),
    [availableBodyHeight, expandedPanes, preferredHeights],
  );

  const paneLayouts = useMemo(() => {
    const layouts: Record<string, SidebarPaneStackLayout> = {};

    if (expandedPanes.length === 1) {
      const pane = expandedPanes[0]!;
      layouts[pane.id] = {
        bodyFillsSection: true,
        sectionStyle: {
          flex: "1 1 0",
          minHeight: 0,
        },
      };

      return layouts;
    }

    expandedPanes.forEach((pane, paneIndex) => {
      layouts[pane.id] = {
        bodyFillsSection: false,
        bodyStyle: {
          height: resolvedHeights[paneIndex],
        },
        sectionStyle: {
          flex: "0 0 auto",
          minHeight: 0,
        },
      };
    });

    return layouts;
  }, [expandedPanes, resolvedHeights]);

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
    paneLayouts,
    resizeHandles,
    getResizeHandleProps,
  };
}

export function SidebarPaneStack({ panes, className }: SidebarPaneStackProps) {
  const { stackRef, paneLayouts, resizeHandles, getResizeHandleProps } = useSidebarPaneStack({
    panes,
  });
  const paneTitleMap = useMemo(
    () => Object.fromEntries(panes.map((pane) => [pane.id, pane.title])),
    [panes],
  );

  return (
    <div ref={stackRef} className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      {panes.map((pane) => {
        const layout = paneLayouts[pane.id];
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
              bodyFillsSection={layout?.bodyFillsSection}
              bodyStyle={layout?.bodyStyle}
              expanded={pane.expanded}
              panelId={pane.panelId}
              sectionStyle={layout?.sectionStyle}
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
