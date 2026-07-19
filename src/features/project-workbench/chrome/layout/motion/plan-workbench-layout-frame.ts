import {
  displayedEqual,
  holdClosedPanelWidth,
  mergeSide,
  oppositeSide,
  sidebarMetricsEqual,
  stabilizeCloseTargets,
  type DisplayedSidebarMetrics,
  type DisplayedWorkbenchChrome,
  type WorkbenchLayoutPhase,
  type WorkbenchLayoutSide,
} from "./workbench-layout-motion";

export type AnimatingSides = "both" | WorkbenchLayoutSide;

export type LayoutVisibilityIntent = {
  primary: boolean;
  auxiliary: boolean;
};

export type LayoutMotionPlanInput = {
  displayed: DisplayedWorkbenchChrome;
  targets: DisplayedWorkbenchChrome;
  activeResizeSide: WorkbenchLayoutSide | null;
  prevActiveResizeSide: WorkbenchLayoutSide | null;
  prevContainerWidth: number;
  containerWidth: number;
  animatingSides: AnimatingSides | null;
  animTarget: DisplayedWorkbenchChrome | null;
  visibilityIntent: LayoutVisibilityIntent;
  motionReady: boolean;
  reducedMotion: boolean;
  phase: WorkbenchLayoutPhase;
};

/**
 * High-level frame outcome for workbench layout motion.
 * The hook executes these commands; this module stays pure.
 */
export type LayoutMotionFramePlan =
  | {
      type: "snap-all";
      next: DisplayedWorkbenchChrome;
      phase: WorkbenchLayoutPhase;
    }
  | {
      type: "drag";
      activeSide: WorkbenchLayoutSide;
      stopBothAnimation: boolean;
      /** Active side metrics after closed-width hold, already merged into `afterActive`. */
      afterActive: DisplayedWorkbenchChrome;
      activeOpen: boolean;
      outcome: DragFrameOutcome;
    }
  | {
      type: "drag-end";
      activeWas: WorkbenchLayoutSide;
      afterActive: DisplayedWorkbenchChrome;
      activeOpen: boolean;
      outcome: DragEndOutcome;
    }
  | {
      type: "lerp-both";
      from: DisplayedWorkbenchChrome;
      to: DisplayedWorkbenchChrome;
      phase: "animating";
    }
  | {
      type: "settle-idle";
    }
  | {
      type: "noop";
    };

export type DragFrameOutcome =
  | {
      type: "passive-lerp";
      passiveSide: WorkbenchLayoutSide;
      to: DisplayedWorkbenchChrome;
      phase: "dragging";
    }
  | {
      type: "keep-passive-tween";
      phase: "dragging";
    }
  | {
      type: "snap-active-and-passive";
      next: DisplayedWorkbenchChrome;
      passiveOpen: boolean;
      stopPassiveAnimation: boolean;
      phase: "dragging";
    };

export type DragEndOutcome =
  | {
      type: "keep-passive-animating";
      phase: "animating";
    }
  | {
      type: "snap-all";
      next: DisplayedWorkbenchChrome;
      phase: "idle";
    }
  | {
      type: "apply-active";
      phase: "idle";
    };

/**
 * Decide what this layout frame should do. Pure: no DOM / animation side effects.
 * Visibility-intent and animation-ref bookkeeping are implied by the command and
 * applied by the hook executor (matching prior inline semantics).
 */
export function planWorkbenchLayoutFrame(input: LayoutMotionPlanInput): LayoutMotionFramePlan {
  const {
    displayed,
    targets,
    activeResizeSide,
    prevActiveResizeSide,
    prevContainerWidth,
    containerWidth,
    animatingSides,
    animTarget,
    visibilityIntent,
    motionReady,
    reducedMotion,
    phase,
  } = input;

  const wasDragging = prevActiveResizeSide != null;
  const isDragging = activeResizeSide != null;
  const containerChanged = prevContainerWidth !== containerWidth;

  if (!motionReady || reducedMotion) {
    return {
      type: "snap-all",
      next: targets,
      phase: isDragging ? "dragging" : "idle",
    };
  }

  if (isDragging) {
    return planDragFrame({
      displayed,
      targets,
      activeSide: activeResizeSide,
      wasDragging,
      animatingSides,
      animTarget,
      visibilityIntent,
    });
  }

  if (wasDragging) {
    return planDragEndFrame({
      displayed,
      targets,
      activeWas: prevActiveResizeSide,
      animatingSides,
    });
  }

  if (containerChanged) {
    return {
      type: "snap-all",
      next: targets,
      phase: "idle",
    };
  }

  // Non-drag target change (toggle / preference) → lockstep both sides.
  // Compare against close-stabilized targets so preferred panelWidth while
  // hidden does not look like a real layout change.
  const stabilizedTargets = stabilizeCloseTargets(displayed, targets);

  if (animTarget != null && displayedEqual(animTarget, stabilizedTargets)) {
    return { type: "noop" };
  }

  if (!displayedEqual(displayed, stabilizedTargets)) {
    return {
      type: "lerp-both",
      from: displayed,
      to: targets,
      phase: "animating",
    };
  }

  if (phase !== "idle" && animatingSides == null) {
    return { type: "settle-idle" };
  }

  return { type: "noop" };
}

function planDragFrame({
  displayed,
  targets,
  activeSide,
  wasDragging,
  animatingSides,
  animTarget,
  visibilityIntent,
}: {
  displayed: DisplayedWorkbenchChrome;
  targets: DisplayedWorkbenchChrome;
  activeSide: WorkbenchLayoutSide;
  wasDragging: boolean;
  animatingSides: AnimatingSides | null;
  animTarget: DisplayedWorkbenchChrome | null;
  visibilityIntent: LayoutVisibilityIntent;
}): Extract<LayoutMotionFramePlan, { type: "drag" }> {
  const passiveSide = oppositeSide(activeSide);
  const activeMetrics = targets[activeSide];
  const passiveTarget = targets[passiveSide];
  const passiveIntent = visibilityIntent[passiveSide];

  // Entering drag cancels a global toggle lockstep; subsequent passive checks
  // must see the cleared animation state (matches prior stopAnimation() timing).
  const stopBothAnimation = !wasDragging && animatingSides === "both";
  const effectiveAnimatingSides = stopBothAnimation ? null : animatingSides;
  const effectiveAnimTarget = stopBothAnimation ? null : animTarget;
  const passiveAnimating =
    effectiveAnimatingSides === passiveSide || effectiveAnimatingSides === "both";
  const animPassiveTarget = effectiveAnimTarget?.[passiveSide] ?? null;

  // Active side always snaps (including self-close via threshold). Hold the
  // current panelWidth when closed so preferred does not jump into displayed.
  const activeDisplayed = holdClosedPanelWidth(displayed[activeSide], activeMetrics);
  const afterActive = mergeSide(displayed, activeSide, activeDisplayed);

  if (passiveTarget.open !== passiveIntent) {
    return {
      type: "drag",
      activeSide,
      stopBothAnimation,
      afterActive,
      activeOpen: activeMetrics.open,
      outcome: {
        type: "passive-lerp",
        passiveSide,
        to: mergeSide(afterActive, passiveSide, passiveTarget),
        phase: "dragging",
      },
    };
  }

  if (
    passiveAnimating &&
    animPassiveTarget != null &&
    animPassiveTarget.open === passiveTarget.open
  ) {
    // Keep passive tween; retarget if open resolved/constrained metrics drifted.
    if (passiveTarget.open && !sidebarMetricsEqual(animPassiveTarget, passiveTarget)) {
      return {
        type: "drag",
        activeSide,
        stopBothAnimation,
        afterActive,
        activeOpen: activeMetrics.open,
        outcome: {
          type: "passive-lerp",
          passiveSide,
          to: mergeSide(afterActive, passiveSide, passiveTarget),
          phase: "dragging",
        },
      };
    }

    return {
      type: "drag",
      activeSide,
      stopBothAnimation,
      afterActive,
      activeOpen: activeMetrics.open,
      outcome: {
        type: "keep-passive-tween",
        phase: "dragging",
      },
    };
  }

  // Closed passive must not snap to resolver preferred every drag frame.
  const next = mergeSide(
    afterActive,
    passiveSide,
    holdClosedPanelWidth(displayed[passiveSide], passiveTarget),
  );

  return {
    type: "drag",
    activeSide,
    stopBothAnimation,
    afterActive,
    activeOpen: activeMetrics.open,
    outcome: {
      type: "snap-active-and-passive",
      next,
      passiveOpen: passiveTarget.open,
      stopPassiveAnimation: passiveAnimating,
      phase: "dragging",
    },
  };
}

function planDragEndFrame({
  displayed,
  targets,
  activeWas,
  animatingSides,
}: {
  displayed: DisplayedWorkbenchChrome;
  targets: DisplayedWorkbenchChrome;
  activeWas: WorkbenchLayoutSide;
  animatingSides: AnimatingSides | null;
}): Extract<LayoutMotionFramePlan, { type: "drag-end" }> {
  const activeEnd = holdClosedPanelWidth(displayed[activeWas], targets[activeWas]);
  const afterActive = mergeSide(displayed, activeWas, activeEnd);
  const activeOpen = targets[activeWas].open;

  if (animatingSides != null) {
    // Passive open/close may still be playing — do not cut it short.
    return {
      type: "drag-end",
      activeWas,
      afterActive,
      activeOpen,
      outcome: {
        type: "keep-passive-animating",
        phase: "animating",
      },
    };
  }

  if (!displayedEqual(afterActive, targets)) {
    // Residual mismatch after drag: snap (drag path does not tween the active side).
    return {
      type: "drag-end",
      activeWas,
      afterActive,
      activeOpen,
      outcome: {
        type: "snap-all",
        next: targets,
        phase: "idle",
      },
    };
  }

  return {
    type: "drag-end",
    activeWas,
    afterActive,
    activeOpen,
    outcome: {
      type: "apply-active",
      phase: "idle",
    },
  };
}

/** Test helper: build metrics quickly. */
export function metricsForPlan(
  partial: Partial<DisplayedSidebarMetrics> & Pick<DisplayedSidebarMetrics, "open">,
): DisplayedSidebarMetrics {
  return {
    spacerWidth: partial.spacerWidth ?? (partial.open ? 264 : 0),
    panelWidth: partial.panelWidth ?? 256,
    opacity: partial.opacity ?? (partial.open ? 1 : 0),
    open: partial.open,
  };
}
