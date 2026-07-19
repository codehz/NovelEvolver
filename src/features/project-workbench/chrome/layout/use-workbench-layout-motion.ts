import { animate } from "motion/react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import type { ResizeSide } from "./use-workbench-sidebar-resize";
import {
  displayedEqual,
  holdClosedPanelWidth,
  lerpDisplayed,
  lerpSidebar,
  mergeSide,
  oppositeSide,
  sidebarMetricsEqual,
  stabilizeCloseTargets,
  stabilizeMotionPair,
  targetsFromChromeLayout,
  WORKBENCH_LAYOUT_MOTION,
  type DisplayedSidebarMetrics,
  type DisplayedWorkbenchChrome,
  type WorkbenchLayoutPhase,
  type WorkbenchLayoutSide,
} from "./workbench-layout-motion";
import type { WorkbenchChromeLayout } from "./workbench-layout-resolver";

type AnimatingSides = "both" | WorkbenchLayoutSide;

type AnimationHandle = ReturnType<typeof animate>;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useWorkbenchLayoutMotion({
  chromeLayout,
  containerWidth,
  activeResizeSide,
}: {
  chromeLayout: WorkbenchChromeLayout;
  containerWidth: number;
  activeResizeSide: ResizeSide | null;
}): {
  displayed: DisplayedWorkbenchChrome;
  phase: WorkbenchLayoutPhase;
} {
  const targets = useMemo(() => targetsFromChromeLayout(chromeLayout), [chromeLayout]);
  const [displayed, setDisplayed] = useState<DisplayedWorkbenchChrome>(() => targets);
  const [phase, setPhase] = useState<WorkbenchLayoutPhase>("idle");

  const displayedRef = useRef(displayed);
  const phaseRef = useRef(phase);
  const targetsRef = useRef(targets);
  const animationRef = useRef<AnimationHandle | null>(null);
  const animatingSidesRef = useRef<AnimatingSides | null>(null);
  const animTargetRef = useRef<DisplayedWorkbenchChrome | null>(null);
  const visibilityIntentRef = useRef({
    primary: targets.primary.open,
    auxiliary: targets.auxiliary.open,
  });
  const prevContainerWidthRef = useRef(containerWidth);
  const prevActiveResizeSideRef = useRef(activeResizeSide);
  const motionReadyRef = useRef(false);
  const reducedMotionRef = useRef(false);

  displayedRef.current = displayed;
  phaseRef.current = phase;
  targetsRef.current = targets;

  useLayoutEffect(() => {
    reducedMotionRef.current = prefersReducedMotion();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      reducedMotionRef.current = media.matches;
    };
    media.addEventListener("change", onChange);

    const frame = requestAnimationFrame(() => {
      motionReadyRef.current = true;
    });

    return () => {
      media.removeEventListener("change", onChange);
      cancelAnimationFrame(frame);
      animationRef.current?.stop();
      animationRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const applyDisplayed = (next: DisplayedWorkbenchChrome) => {
      displayedRef.current = next;
      setDisplayed(next);
    };

    const setPhaseNow = (next: WorkbenchLayoutPhase) => {
      phaseRef.current = next;
      setPhase(next);
    };

    const stopAnimation = () => {
      animationRef.current?.stop();
      animationRef.current = null;
      animatingSidesRef.current = null;
      animTargetRef.current = null;
    };

    const commitVisibilityIntent = (next: DisplayedWorkbenchChrome, sides: AnimatingSides) => {
      if (sides === "both" || sides === "primary") {
        visibilityIntentRef.current.primary = next.primary.open;
      }
      if (sides === "both" || sides === "auxiliary") {
        visibilityIntentRef.current.auxiliary = next.auxiliary.open;
      }
    };

    const snapSides = (next: DisplayedWorkbenchChrome, sides: AnimatingSides) => {
      if (sides === "both") {
        stopAnimation();
        applyDisplayed(next);
        commitVisibilityIntent(next, "both");
        return;
      }

      if (animatingSidesRef.current === "both" || animatingSidesRef.current === sides) {
        stopAnimation();
      }

      applyDisplayed(mergeSide(displayedRef.current, sides, next[sides]));
      commitVisibilityIntent(next, sides);
    };

    const snapAll = (next: DisplayedWorkbenchChrome, nextPhase: WorkbenchLayoutPhase) => {
      stopAnimation();
      applyDisplayed(next);
      commitVisibilityIntent(next, "both");
      setPhaseNow(nextPhase);
    };

    const finishAnimationTo = (to: DisplayedWorkbenchChrome, sides: AnimatingSides) => {
      const current = displayedRef.current;
      const next =
        sides === "both"
          ? to
          : sides === "primary"
            ? { primary: to.primary, auxiliary: current.auxiliary }
            : { primary: current.primary, auxiliary: to.auxiliary };

      applyDisplayed(next);
      commitVisibilityIntent(next, sides);
      animationRef.current = null;
      animatingSidesRef.current = null;
      animTargetRef.current = null;

      if (prevActiveResizeSideRef.current != null) {
        setPhaseNow("dragging");
      } else {
        setPhaseNow("idle");
      }
    };

    const startLerp = (
      from: DisplayedWorkbenchChrome,
      to: DisplayedWorkbenchChrome,
      sides: AnimatingSides,
      nextPhase: WorkbenchLayoutPhase,
    ) => {
      // Close: hold current panelWidth (resolver preferred must not expand while fading).
      // Open: snap source panelWidth to the open target so only spacer/opacity animate.
      const { from: stabilizedFrom, to: stabilizedTo } = stabilizeMotionPair(from, to);
      const unchanged =
        sides === "both"
          ? displayedEqual(stabilizedFrom, stabilizedTo)
          : sidebarMetricsEqual(stabilizedFrom[sides], stabilizedTo[sides]);

      if (reducedMotionRef.current || !motionReadyRef.current || unchanged) {
        snapSides(stabilizedTo, sides);
        setPhaseNow(prevActiveResizeSideRef.current != null ? "dragging" : "idle");
        return;
      }

      const animTarget =
        sides === "both"
          ? stabilizedTo
          : sides === "primary"
            ? { primary: stabilizedTo.primary, auxiliary: stabilizedFrom.auxiliary }
            : { primary: stabilizedFrom.primary, auxiliary: stabilizedTo.auxiliary };

      stopAnimation();
      animatingSidesRef.current = sides;
      animTargetRef.current = animTarget;
      commitVisibilityIntent(stabilizedTo, sides);
      setPhaseNow(nextPhase);

      const fromSnapshot: DisplayedWorkbenchChrome = {
        primary: stabilizedFrom.primary,
        auxiliary: stabilizedFrom.auxiliary,
      };

      animationRef.current = animate(0, 1, {
        duration: WORKBENCH_LAYOUT_MOTION.duration,
        ease: WORKBENCH_LAYOUT_MOTION.ease,
        onUpdate: (progress) => {
          const current = displayedRef.current;
          if (sides === "both") {
            applyDisplayed(lerpDisplayed(fromSnapshot, stabilizedTo, progress));
            return;
          }

          const lerped = lerpSidebar(fromSnapshot[sides], stabilizedTo[sides], progress);
          applyDisplayed(mergeSide(current, sides, lerped));
        },
        onComplete: () => {
          finishAnimationTo(stabilizedTo, sides);
        },
      });
    };

    const targetsNow = targetsRef.current;
    const wasDragging = prevActiveResizeSideRef.current != null;
    const isDragging = activeResizeSide != null;
    const containerChanged = prevContainerWidthRef.current !== containerWidth;

    const markPrev = () => {
      prevContainerWidthRef.current = containerWidth;
      prevActiveResizeSideRef.current = activeResizeSide;
    };

    if (!motionReadyRef.current || reducedMotionRef.current) {
      snapAll(targetsNow, isDragging ? "dragging" : "idle");
      markPrev();
      return;
    }

    if (isDragging) {
      const activeSide = activeResizeSide;
      const passiveSide = oppositeSide(activeSide);
      const activeMetrics = targetsNow[activeSide];
      const passiveTarget = targetsNow[passiveSide];
      const passiveIntent = visibilityIntentRef.current[passiveSide];
      const passiveAnimating =
        animatingSidesRef.current === passiveSide || animatingSidesRef.current === "both";
      const animPassiveTarget = animTargetRef.current?.[passiveSide] ?? null;

      // Entering drag cancels a global toggle lockstep; passive may retarget below.
      if (!wasDragging && animatingSidesRef.current === "both") {
        stopAnimation();
      }

      // Active side always snaps (including self-close via threshold). Hold the
      // current panelWidth when closed so preferred does not jump into displayed.
      const activeDisplayed = holdClosedPanelWidth(displayedRef.current[activeSide], activeMetrics);
      let next = mergeSide(displayedRef.current, activeSide, activeDisplayed);
      visibilityIntentRef.current[activeSide] = activeMetrics.open;

      if (passiveTarget.open !== passiveIntent) {
        applyDisplayed(next);
        startLerp(
          displayedRef.current,
          mergeSide(displayedRef.current, passiveSide, passiveTarget),
          passiveSide,
          "dragging",
        );
        markPrev();
        return;
      }

      if (
        passiveAnimating &&
        animPassiveTarget != null &&
        animPassiveTarget.open === passiveTarget.open
      ) {
        // Keep passive tween; retarget if open resolved/constrained metrics drifted.
        if (passiveTarget.open && !sidebarMetricsEqual(animPassiveTarget, passiveTarget)) {
          applyDisplayed(next);
          startLerp(
            displayedRef.current,
            mergeSide(displayedRef.current, passiveSide, passiveTarget),
            passiveSide,
            "dragging",
          );
          markPrev();
          return;
        }

        applyDisplayed(next);
        setPhaseNow("dragging");
        markPrev();
        return;
      }

      if (passiveAnimating) {
        stopAnimation();
      }

      // Closed passive must not snap to resolver preferred every drag frame.
      next = mergeSide(
        next,
        passiveSide,
        holdClosedPanelWidth(displayedRef.current[passiveSide], passiveTarget),
      );

      visibilityIntentRef.current[passiveSide] = passiveTarget.open;
      applyDisplayed(next);
      setPhaseNow("dragging");
      markPrev();
      return;
    }

    // Drag ended this frame.
    if (wasDragging) {
      const activeWas = prevActiveResizeSideRef.current!;
      const activeEnd = holdClosedPanelWidth(
        displayedRef.current[activeWas],
        targetsNow[activeWas],
      );
      let next = mergeSide(displayedRef.current, activeWas, activeEnd);
      visibilityIntentRef.current[activeWas] = targetsNow[activeWas].open;

      if (animatingSidesRef.current != null) {
        // Passive open/close may still be playing — do not cut it short.
        applyDisplayed(next);
        setPhaseNow("animating");
        markPrev();
        return;
      }

      if (!displayedEqual(next, targetsNow)) {
        // Residual mismatch after drag: snap (drag path does not tween the active side).
        snapAll(targetsNow, "idle");
        markPrev();
        return;
      }

      applyDisplayed(next);
      setPhaseNow("idle");
      markPrev();
      return;
    }

    if (containerChanged) {
      snapAll(targetsNow, "idle");
      markPrev();
      return;
    }

    // Non-drag target change (toggle / preference) → lockstep both sides.
    // Compare against close-stabilized targets so preferred panelWidth while
    // hidden does not look like a real layout change.
    const stabilizedTargets = stabilizeCloseTargets(displayedRef.current, targetsNow);

    if (animTargetRef.current != null && displayedEqual(animTargetRef.current, stabilizedTargets)) {
      markPrev();
      return;
    }

    if (!displayedEqual(displayedRef.current, stabilizedTargets)) {
      startLerp(displayedRef.current, targetsNow, "both", "animating");
      markPrev();
      return;
    }

    if (phaseRef.current !== "idle" && animatingSidesRef.current == null) {
      setPhaseNow("idle");
    }

    markPrev();
  }, [activeResizeSide, chromeLayout, containerWidth, targets]);

  return { displayed, phase };
}

export type { DisplayedSidebarMetrics, DisplayedWorkbenchChrome, WorkbenchLayoutPhase };
