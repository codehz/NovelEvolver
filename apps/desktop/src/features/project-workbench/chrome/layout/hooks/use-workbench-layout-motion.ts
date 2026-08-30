import { animate } from "motion/react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  planWorkbenchLayoutFrame,
  type AnimatingSides,
  type LayoutVisibilityIntent,
} from "../motion/plan-workbench-layout-frame";
import {
  displayedEqual,
  lerpDisplayed,
  lerpSidebar,
  mergeSide,
  sidebarMetricsEqual,
  stabilizeMotionPair,
  targetsFromChromeLayout,
  WORKBENCH_LAYOUT_MOTION,
  type DisplayedSidebarMetrics,
  type DisplayedWorkbenchChrome,
  type WorkbenchLayoutPhase,
} from "../motion/workbench-layout-motion";
import type { WorkbenchChromeLayout } from "../resolve/workbench-layout-resolver";
import type { ResizeSide } from "./use-workbench-sidebar-resize";

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
  const visibilityIntentRef = useRef<LayoutVisibilityIntent>({
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

    const markPrev = () => {
      prevContainerWidthRef.current = containerWidth;
      prevActiveResizeSideRef.current = activeResizeSide;
    };

    const plan = planWorkbenchLayoutFrame({
      displayed: displayedRef.current,
      targets: targetsRef.current,
      activeResizeSide,
      prevActiveResizeSide: prevActiveResizeSideRef.current,
      prevContainerWidth: prevContainerWidthRef.current,
      containerWidth,
      animatingSides: animatingSidesRef.current,
      animTarget: animTargetRef.current,
      visibilityIntent: visibilityIntentRef.current,
      motionReady: motionReadyRef.current,
      reducedMotion: reducedMotionRef.current,
      phase: phaseRef.current,
    });

    switch (plan.type) {
      case "snap-all": {
        snapAll(plan.next, plan.phase);
        markPrev();
        return;
      }
      case "lerp-both": {
        startLerp(plan.from, plan.to, "both", plan.phase);
        markPrev();
        return;
      }
      case "settle-idle": {
        setPhaseNow("idle");
        markPrev();
        return;
      }
      case "noop": {
        markPrev();
        return;
      }
      case "drag": {
        if (plan.stopBothAnimation) {
          stopAnimation();
        }

        visibilityIntentRef.current[plan.activeSide] = plan.activeOpen;

        switch (plan.outcome.type) {
          case "passive-lerp": {
            applyDisplayed(plan.afterActive);
            startLerp(
              displayedRef.current,
              plan.outcome.to,
              plan.outcome.passiveSide,
              plan.outcome.phase,
            );
            markPrev();
            return;
          }
          case "keep-passive-tween": {
            applyDisplayed(plan.afterActive);
            setPhaseNow(plan.outcome.phase);
            markPrev();
            return;
          }
          case "snap-active-and-passive": {
            if (plan.outcome.stopPassiveAnimation) {
              stopAnimation();
            }
            visibilityIntentRef.current[plan.activeSide === "primary" ? "auxiliary" : "primary"] =
              plan.outcome.passiveOpen;
            // active already committed above; also write passive intent
            applyDisplayed(plan.outcome.next);
            setPhaseNow(plan.outcome.phase);
            markPrev();
            return;
          }
        }
        return;
      }
      case "drag-end": {
        visibilityIntentRef.current[plan.activeWas] = plan.activeOpen;

        switch (plan.outcome.type) {
          case "keep-passive-animating": {
            applyDisplayed(plan.afterActive);
            setPhaseNow(plan.outcome.phase);
            markPrev();
            return;
          }
          case "snap-all": {
            snapAll(plan.outcome.next, plan.outcome.phase);
            markPrev();
            return;
          }
          case "apply-active": {
            applyDisplayed(plan.afterActive);
            setPhaseNow(plan.outcome.phase);
            markPrev();
            return;
          }
        }
        return;
      }
    }
  }, [activeResizeSide, chromeLayout, containerWidth, targets]);

  return { displayed, phase };
}

export type { DisplayedSidebarMetrics, DisplayedWorkbenchChrome, WorkbenchLayoutPhase };
