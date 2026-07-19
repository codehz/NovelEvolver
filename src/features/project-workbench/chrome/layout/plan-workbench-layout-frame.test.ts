import { describe, expect, test } from "bun:test";

import {
  metricsForPlan,
  planWorkbenchLayoutFrame,
  type LayoutMotionPlanInput,
} from "./plan-workbench-layout-frame";
import type { DisplayedWorkbenchChrome } from "./workbench-layout-motion";

function chrome(
  primaryOpen: boolean,
  auxiliaryOpen: boolean,
  widths: { primary?: number; auxiliary?: number } = {},
): DisplayedWorkbenchChrome {
  return {
    primary: metricsForPlan({
      open: primaryOpen,
      panelWidth: widths.primary ?? 256,
      spacerWidth: primaryOpen ? 264 : 0,
      opacity: primaryOpen ? 1 : 0,
    }),
    auxiliary: metricsForPlan({
      open: auxiliaryOpen,
      panelWidth: widths.auxiliary ?? 320,
      spacerWidth: auxiliaryOpen ? 328 : 0,
      opacity: auxiliaryOpen ? 1 : 0,
    }),
  };
}

function baseInput(overrides: Partial<LayoutMotionPlanInput> = {}): LayoutMotionPlanInput {
  const both = chrome(true, true);
  return {
    displayed: both,
    targets: both,
    activeResizeSide: null,
    prevActiveResizeSide: null,
    prevContainerWidth: 1400,
    containerWidth: 1400,
    animatingSides: null,
    animTarget: null,
    visibilityIntent: { primary: true, auxiliary: true },
    motionReady: true,
    reducedMotion: false,
    phase: "idle",
    ...overrides,
  };
}

describe("planWorkbenchLayoutFrame — readiness", () => {
  test("not ready → snap-all to targets", () => {
    const targets = chrome(false, true);
    const plan = planWorkbenchLayoutFrame(
      baseInput({ motionReady: false, targets, activeResizeSide: "primary" }),
    );
    expect(plan).toEqual({ type: "snap-all", next: targets, phase: "dragging" });
  });

  test("reduced motion → snap-all idle when not dragging", () => {
    const targets = chrome(true, false);
    const plan = planWorkbenchLayoutFrame(baseInput({ reducedMotion: true, targets }));
    expect(plan).toEqual({ type: "snap-all", next: targets, phase: "idle" });
  });
});

describe("planWorkbenchLayoutFrame — idle toggle", () => {
  test("open→close both sides → lerp-both", () => {
    const displayed = chrome(true, true);
    const targets = chrome(false, true);
    const plan = planWorkbenchLayoutFrame(baseInput({ displayed, targets }));
    expect(plan.type).toBe("lerp-both");
    if (plan.type === "lerp-both") {
      expect(plan.from).toEqual(displayed);
      expect(plan.to).toEqual(targets);
      expect(plan.phase).toBe("animating");
    }
  });

  test("already at anim target → noop", () => {
    const displayed = chrome(true, true, { primary: 210 });
    const targets = chrome(false, true, { primary: 400 });
    // animTarget matches close-stabilized targets (panelWidth held at 210).
    const animTarget = {
      primary: metricsForPlan({
        open: false,
        panelWidth: 210,
        spacerWidth: 0,
        opacity: 0,
      }),
      auxiliary: displayed.auxiliary,
    };
    const plan = planWorkbenchLayoutFrame(
      baseInput({
        displayed,
        targets,
        animTarget,
        animatingSides: "both",
        phase: "animating",
      }),
    );
    expect(plan.type).toBe("noop");
  });

  test("phase residual without animation → settle-idle", () => {
    const both = chrome(true, true);
    const plan = planWorkbenchLayoutFrame(
      baseInput({ displayed: both, targets: both, phase: "dragging", animatingSides: null }),
    );
    expect(plan.type).toBe("settle-idle");
  });
});

describe("planWorkbenchLayoutFrame — container resize", () => {
  test("container width change snaps without animation", () => {
    const targets = chrome(true, false);
    const plan = planWorkbenchLayoutFrame(
      baseInput({
        targets,
        prevContainerWidth: 1400,
        containerWidth: 900,
      }),
    );
    expect(plan).toEqual({ type: "snap-all", next: targets, phase: "idle" });
  });
});

describe("planWorkbenchLayoutFrame — drag", () => {
  test("active side snaps with closed panelWidth hold", () => {
    const displayed = chrome(true, true, { primary: 220 });
    const targets = {
      primary: metricsForPlan({ open: false, panelWidth: 400, spacerWidth: 0, opacity: 0 }),
      auxiliary: displayed.auxiliary,
    };
    const plan = planWorkbenchLayoutFrame(
      baseInput({
        displayed,
        targets,
        activeResizeSide: "primary",
        visibilityIntent: { primary: true, auxiliary: true },
      }),
    );
    expect(plan.type).toBe("drag");
    if (plan.type === "drag") {
      expect(plan.afterActive.primary.open).toBe(false);
      expect(plan.afterActive.primary.panelWidth).toBe(220);
      expect(plan.outcome.type).toBe("snap-active-and-passive");
    }
  });

  test("passive visibility flip → passive-lerp", () => {
    const displayed = chrome(true, true);
    const targets = chrome(true, false);
    const plan = planWorkbenchLayoutFrame(
      baseInput({
        displayed,
        targets,
        activeResizeSide: "primary",
        visibilityIntent: { primary: true, auxiliary: true },
      }),
    );
    expect(plan.type).toBe("drag");
    if (plan.type === "drag") {
      expect(plan.outcome.type).toBe("passive-lerp");
      if (plan.outcome.type === "passive-lerp") {
        expect(plan.outcome.passiveSide).toBe("auxiliary");
        expect(plan.outcome.to.auxiliary.open).toBe(false);
      }
    }
  });

  test("entering drag cancels both-side animation flag", () => {
    const displayed = chrome(true, true);
    const plan = planWorkbenchLayoutFrame(
      baseInput({
        displayed,
        targets: displayed,
        activeResizeSide: "primary",
        prevActiveResizeSide: null,
        animatingSides: "both",
        animTarget: displayed,
      }),
    );
    expect(plan.type).toBe("drag");
    if (plan.type === "drag") {
      expect(plan.stopBothAnimation).toBe(true);
    }
  });

  test("passive tween kept when open intent matches", () => {
    const displayed = chrome(true, true);
    const targets = chrome(true, false);
    const animTarget = chrome(true, false);
    const plan = planWorkbenchLayoutFrame(
      baseInput({
        displayed,
        targets,
        activeResizeSide: "primary",
        prevActiveResizeSide: "primary",
        animatingSides: "auxiliary",
        animTarget,
        visibilityIntent: { primary: true, auxiliary: false },
      }),
    );
    expect(plan.type).toBe("drag");
    if (plan.type === "drag") {
      expect(plan.outcome.type).toBe("keep-passive-tween");
    }
  });
});

describe("planWorkbenchLayoutFrame — drag end", () => {
  test("residual mismatch after drag → snap-all", () => {
    // Closed active holds displayed panelWidth (220); targets still carry preferred (400).
    const displayed = {
      primary: metricsForPlan({ open: false, panelWidth: 220, spacerWidth: 0, opacity: 0 }),
      auxiliary: metricsForPlan({ open: true, panelWidth: 320, spacerWidth: 328, opacity: 1 }),
    };
    const targets = {
      primary: metricsForPlan({ open: false, panelWidth: 400, spacerWidth: 0, opacity: 0 }),
      auxiliary: displayed.auxiliary,
    };
    const plan = planWorkbenchLayoutFrame(
      baseInput({
        displayed,
        targets,
        activeResizeSide: null,
        prevActiveResizeSide: "primary",
        animatingSides: null,
      }),
    );
    expect(plan.type).toBe("drag-end");
    if (plan.type === "drag-end") {
      expect(plan.afterActive.primary.panelWidth).toBe(220);
      expect(plan.outcome.type).toBe("snap-all");
      if (plan.outcome.type === "snap-all") {
        expect(plan.outcome.next).toEqual(targets);
      }
    }
  });

  test("passive still animating → keep phase animating", () => {
    const displayed = chrome(true, true);
    const targets = chrome(true, true);
    const plan = planWorkbenchLayoutFrame(
      baseInput({
        displayed,
        targets,
        activeResizeSide: null,
        prevActiveResizeSide: "primary",
        animatingSides: "auxiliary",
      }),
    );
    expect(plan.type).toBe("drag-end");
    if (plan.type === "drag-end") {
      expect(plan.outcome).toEqual({ type: "keep-passive-animating", phase: "animating" });
    }
  });

  test("matched targets → apply-active idle", () => {
    const both = chrome(true, true);
    const plan = planWorkbenchLayoutFrame(
      baseInput({
        displayed: both,
        targets: both,
        activeResizeSide: null,
        prevActiveResizeSide: "auxiliary",
      }),
    );
    expect(plan.type).toBe("drag-end");
    if (plan.type === "drag-end") {
      expect(plan.outcome).toEqual({ type: "apply-active", phase: "idle" });
    }
  });
});
