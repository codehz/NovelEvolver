import type { AiSubagentToolView, AiSubagentViewStep, AiToolViewFocus } from "#domain/ai";

import type { SubagentArtifacts, SubagentRunStatus } from "./result";
import {
  createViewThrottle,
  PARTIAL_SUMMARY_THROTTLE_MS,
  truncatePartialSummary,
} from "./throttle";

export type SubagentViewPhase = AiSubagentToolView["phase"];

export type SubagentViewReporter = {
  emit: (phase: Exclude<SubagentViewPhase, "done">) => void;
  setReport: (text: string) => void;
  beginStep: (input: { name: string; subject: string | null }) => string;
  completeStep: (input: {
    id: string;
    status: "complete" | "error";
    subject?: string | null;
    outcome: string | null;
    errorMessage?: string | null;
  }) => void;
  setArtifacts: (artifacts: SubagentArtifacts) => void;
  bumpRound: () => number;
  forceFlush: () => void;
  cancel: () => void;
  /** Terminal snapshot with phase done + runStatus. */
  finalize: (runStatus: SubagentRunStatus) => AiSubagentToolView;
  snapshot: () => AiSubagentToolView;
};

export type CreateSubagentViewReporterOptions = {
  agentId: string;
  agentName: string;
  task: string;
  constraints: string | null;
  focus: AiToolViewFocus[];
  /** Independent tool-loop budget for this subagent run (shown in UI). */
  maxRounds: number;
  onView?: (view: AiSubagentToolView) => void;
};

function emptyArtifacts(): SubagentArtifacts {
  return { touched_node_ids: [], wrote: false };
}

function toTouched(artifacts: SubagentArtifacts): AiSubagentToolView["artifacts"]["touched"] {
  return artifacts.touched_node_ids.map((id) => ({ id }));
}

export function buildStepsDigest(steps: readonly AiSubagentViewStep[]): string {
  const completed = steps.filter((step) => step.status === "complete" || step.status === "error");
  if (completed.length === 0) {
    return "";
  }
  return completed
    .map((step) => {
      const verb = step.name;
      const subject = step.subject ? ` ${step.subject}` : "";
      const outcome = step.outcome
        ? ` → ${step.outcome}`
        : step.status === "error"
          ? " → 失败"
          : "";
      return `${verb}${subject}${outcome}`;
    })
    .join("；");
}

export function createSubagentViewReporter(
  options: CreateSubagentViewReporterOptions,
): SubagentViewReporter {
  let round = 0;
  let report = "";
  let phase: Exclude<SubagentViewPhase, "done"> = "starting";
  let runStatus: AiSubagentToolView["runStatus"] = null;
  let steps: AiSubagentViewStep[] = [];
  let artifacts = emptyArtifacts();
  let stepSeq = 0;

  const maxRounds = Math.max(1, Math.floor(options.maxRounds));

  const build = (nextPhase: SubagentViewPhase = phase): AiSubagentToolView => ({
    kind: "subagent",
    agentId: options.agentId,
    agentName: options.agentName,
    task: options.task,
    constraints: options.constraints,
    focus: options.focus.map((entry) => ({ ...entry })),
    phase: nextPhase,
    round,
    maxRounds,
    steps: steps.map((step) => ({ ...step })),
    report: report !== "" ? report : null,
    runStatus,
    artifacts: {
      wrote: artifacts.wrote,
      touched: toTouched(artifacts),
    },
  });

  const emitRaw = (view: AiSubagentToolView) => {
    options.onView?.(view);
  };

  const throttle = createViewThrottle<AiSubagentToolView>({
    onEmit: emitRaw,
    intervalMs: PARTIAL_SUMMARY_THROTTLE_MS,
  });

  return {
    emit(nextPhase) {
      phase = nextPhase;
      throttle.forceFlush();
      emitRaw(build(phase));
    },
    setReport(text) {
      report = truncatePartialSummary(text);
      if (phase === "starting") {
        phase = "thinking";
      }
      throttle.schedule(build(phase));
    },
    beginStep(input) {
      stepSeq += 1;
      const id = `step-${stepSeq}`;
      steps = [
        ...steps,
        {
          id,
          name: input.name,
          status: "running",
          subject: input.subject,
          outcome: null,
        },
      ];
      phase = "tool";
      throttle.forceFlush();
      emitRaw(build("tool"));
      return id;
    },
    completeStep(input) {
      steps = steps.map((step) =>
        step.id === input.id
          ? {
              ...step,
              status: input.status,
              subject: input.subject !== undefined ? input.subject : step.subject,
              outcome: input.outcome,
              errorMessage: input.errorMessage ?? null,
            }
          : step,
      );
      throttle.forceFlush();
      emitRaw(build(phase));
    },
    setArtifacts(next) {
      artifacts = next;
    },
    bumpRound() {
      round += 1;
      return round;
    },
    forceFlush() {
      throttle.forceFlush();
    },
    cancel() {
      throttle.cancel();
    },
    finalize(status) {
      runStatus = status;
      throttle.forceFlush();
      const view = build("done");
      emitRaw(view);
      return view;
    },
    snapshot() {
      return build(phase);
    },
  };
}
