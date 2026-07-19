import { describe, expect, test } from "bun:test";

import { truncatePartialSummary } from "./throttle";
import { buildStepsDigest, createSubagentViewReporter } from "./view-reporter";

describe("truncatePartialSummary", () => {
  test("keeps short text", () => {
    expect(truncatePartialSummary("hello")).toBe("hello");
  });

  test("keeps the tail of long text", () => {
    const long = `${"a".repeat(50)}TAIL`;
    const result = truncatePartialSummary(long, 10);
    expect(result.startsWith("…")).toBe(true);
    expect(result.endsWith("TAIL")).toBe(true);
    expect(result.length).toBe(10);
  });
});

describe("createSubagentViewReporter", () => {
  test("records full step timeline", () => {
    const views: string[] = [];
    const reporter = createSubagentViewReporter({
      agentId: "a",
      agentName: "审查",
      task: "检查人设",
      constraints: null,
      focus: [],
      onView: (view) => {
        views.push(view.phase);
      },
    });

    reporter.emit("starting");
    reporter.bumpRound();
    reporter.emit("thinking");
    const stepId = reporter.beginStep({ name: "read_document", subject: "第一章" });
    reporter.completeStep({
      id: stepId,
      status: "complete",
      subject: "手稿 · 第一章",
      outcome: "12 字符",
    });
    const final = reporter.finalize("completed");

    expect(final.phase).toBe("done");
    expect(final.runStatus).toBe("completed");
    expect(final.steps).toHaveLength(1);
    expect(final.steps[0]?.name).toBe("read_document");
    expect(final.steps[0]?.outcome).toBe("12 字符");
    expect(buildStepsDigest(final.steps)).toContain("read_document");
    expect(views[0]).toBe("starting");
    expect(views).toContain("tool");
    expect(views.at(-1)).toBe("done");
  });
});
