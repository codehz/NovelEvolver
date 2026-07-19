import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { beginPointerDragSession } from "../pointer-drag-session";
import {
  applyResizeDelta,
  displayHeightsEqual,
  expandedSignature,
  resolveAvailableBodyHeight,
  resolveDisplayHeights,
  SIDEBAR_SECTION_HEADER_HEIGHT_PX,
  sum,
  type SidebarPaneGeometryInput,
} from "./sidebar-pane-geometry";

const PANE_HEIGHT_ANIMATION_MS = 250;

type SidebarPanePhase = "idle" | "animating" | "resizing";

export type SidebarPaneStackPane = SidebarPaneGeometryInput;

export type SidebarPaneResizeHandle = {
  id: string;
  anchorPaneId: string;
  lowerPaneId: string;
  upperPaneId: string;
};

export function useSidebarPaneStack({ panes }: { panes: SidebarPaneStackPane[] }) {
  const [containerHeight, setContainerHeight] = useState(
    panes.length * SIDEBAR_SECTION_HEADER_HEIGHT_PX +
      sum(panes.filter((pane) => pane.expanded).map((pane) => pane.defaultBodyHeight)),
  );
  const [preferredHeights, setPreferredHeights] = useState<Record<string, number>>(() =>
    Object.fromEntries(panes.map((pane) => [pane.id, pane.defaultBodyHeight])),
  );
  const [displayHeights, setDisplayHeights] = useState<Record<string, number>>(() =>
    Object.fromEntries(panes.map((pane) => [pane.id, pane.expanded ? pane.defaultBodyHeight : 0])),
  );
  const [phase, setPhase] = useState<SidebarPanePhase>("idle");
  const [motionEnabled, setMotionEnabled] = useState(false);
  const [activeResizeHandleId, setActiveResizeHandleId] = useState<string | null>(null);

  const stackRef = useRef<HTMLDivElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const phaseRef = useRef<SidebarPanePhase>("idle");
  const signatureRef = useRef(expandedSignature(panes));
  const motionReadyRef = useRef(false);
  const animGenerationRef = useRef(0);
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preferredHeightsRef = useRef(preferredHeights);
  const containerHeightRef = useRef(containerHeight);
  const panesRef = useRef(panes);
  const displayHeightsRef = useRef(displayHeights);

  phaseRef.current = phase;
  preferredHeightsRef.current = preferredHeights;
  containerHeightRef.current = containerHeight;
  panesRef.current = panes;
  displayHeightsRef.current = displayHeights;

  const clearAnimTimeout = useCallback(() => {
    if (animTimeoutRef.current !== null) {
      clearTimeout(animTimeoutRef.current);
      animTimeoutRef.current = null;
    }
  }, []);

  const computeTargets = useCallback(
    (
      nextPanes: SidebarPaneStackPane[] = panesRef.current,
      nextPreferred: Record<string, number> = preferredHeightsRef.current,
      nextContainerHeight: number = containerHeightRef.current,
    ) => {
      const expandedCount = nextPanes.filter((pane) => pane.expanded).length;
      const availableBodyHeight = resolveAvailableBodyHeight(
        nextContainerHeight,
        nextPanes.length,
        expandedCount,
      );
      return resolveDisplayHeights(nextPanes, nextPreferred, availableBodyHeight);
    },
    [],
  );

  const finishAnimation = useCallback(() => {
    clearAnimTimeout();
    const targets = computeTargets();
    signatureRef.current = expandedSignature(panesRef.current);
    setDisplayHeights(targets.displayHeights);
    setMotionEnabled(false);
    setPhase("idle");
    phaseRef.current = "idle";
  }, [clearAnimTimeout, computeTargets]);

  const startAnimation = useCallback(
    (nextDisplayHeights: Record<string, number>) => {
      clearAnimTimeout();
      animGenerationRef.current += 1;
      const generation = animGenerationRef.current;
      setMotionEnabled(true);
      setPhase("animating");
      phaseRef.current = "animating";
      setDisplayHeights(nextDisplayHeights);
      animTimeoutRef.current = setTimeout(() => {
        if (animGenerationRef.current !== generation) {
          return;
        }
        finishAnimation();
      }, PANE_HEIGHT_ANIMATION_MS);
    },
    [clearAnimTimeout, finishAnimation],
  );

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
    const frame = requestAnimationFrame(() => {
      motionReadyRef.current = true;
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

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
      clearAnimTimeout();
    };
  }, [clearAnimTimeout]);

  const expandedPanes = useMemo(() => panes.filter((pane) => pane.expanded), [panes]);
  const availableBodyHeight = resolveAvailableBodyHeight(
    containerHeight,
    panes.length,
    expandedPanes.length,
  );
  const targets = useMemo(
    () => resolveDisplayHeights(panes, preferredHeights, availableBodyHeight),
    [availableBodyHeight, panes, preferredHeights],
  );
  const signature = expandedSignature(panes);

  useLayoutEffect(() => {
    const nextHeights = targets.displayHeights;
    const signatureChanged = signature !== signatureRef.current;
    const currentPhase = phaseRef.current;

    const applyHeights = (heights: Record<string, number>, withMotion: boolean) => {
      setMotionEnabled(withMotion);
      if (!displayHeightsEqual(displayHeightsRef.current, heights)) {
        setDisplayHeights(heights);
      }
    };

    if (currentPhase === "resizing") {
      applyHeights(nextHeights, false);
      return;
    }

    if (currentPhase === "animating") {
      // Ignore expanded flips mid-animation; still track container/preferred target updates.
      if (!signatureChanged) {
        applyHeights(nextHeights, true);
      }
      return;
    }

    // idle
    if (signatureChanged) {
      signatureRef.current = signature;
      if (motionReadyRef.current) {
        startAnimation(nextHeights);
      } else {
        applyHeights(nextHeights, false);
      }
      return;
    }

    applyHeights(nextHeights, false);
  }, [signature, startAnimation, targets]);

  const resizeHandles = useMemo(
    (): SidebarPaneResizeHandle[] =>
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
        if (event.button !== 0 || phaseRef.current !== "idle") {
          return;
        }

        const handleIndex = resizeHandles.findIndex((handle) => handle.id === handleId);
        if (handleIndex < 0) {
          return;
        }

        event.preventDefault();
        dragCleanupRef.current?.();

        const latest = computeTargets();
        const startY = event.clientY;
        const startPaneIds = latest.expandedPanes.map((pane) => pane.id);
        const startHeights = [...latest.resolvedHeights];
        const startMinHeights = [...latest.effectiveMinHeights];

        setMotionEnabled(false);
        setPhase("resizing");
        phaseRef.current = "resizing";
        setActiveResizeHandleId(handleId);

        dragCleanupRef.current = beginPointerDragSession({
          cursor: "row-resize",
          onMove: (moveEvent) => {
            const delta = Math.round(moveEvent.clientY - startY);
            const nextHeights = applyResizeDelta(startHeights, startMinHeights, handleIndex, delta);

            setPreferredHeights((current) => {
              const next = { ...current };

              startPaneIds.forEach((paneId, paneIndex) => {
                next[paneId] = nextHeights[paneIndex]!;
              });

              return next;
            });
          },
          onEnd: () => {
            setActiveResizeHandleId(null);
            setPhase("idle");
            phaseRef.current = "idle";
            dragCleanupRef.current = null;
          },
        });
      },
    }),
    [activeResizeHandleId, computeTargets, resizeHandles],
  );

  const canToggle = phase === "idle";
  const showResizeHandles = phase === "idle";

  return {
    stackRef,
    displayHeights,
    motionEnabled,
    canToggle,
    showResizeHandles,
    resizeHandles,
    getResizeHandleProps,
  };
}
