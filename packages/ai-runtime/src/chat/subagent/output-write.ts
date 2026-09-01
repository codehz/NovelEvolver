import type { WorktreeSession } from "@novelevolver/worktree";

import { parseDocumentDomain, parseNonEmptyString } from "../../tools/parse";
import {
  computeTextStats,
  type TextStats,
  type TextStatsDelta,
  withWriteStats,
} from "../../tools/text-stats";

export type SubagentOutputTarget = {
  domain: "manuscript" | "resource";
  id: string;
};

export type CapturedSubagentOutputTarget = SubagentOutputTarget & {
  expectedRevision: number;
  label: string;
  displayPath: string;
  kind: "chapter" | "file";
};

export type SubagentOutputResult = {
  written: boolean;
  error: string | null;
  target: {
    domain: "manuscript" | "resource";
    id: string;
    kind: "chapter" | "file";
    label: string;
    display_path: string;
  } | null;
  stats: TextStats | null;
  previous_stats: TextStats | null;
  delta: TextStatsDelta | null;
  revision: number | null;
};

function emptyOutputResult(error: string | null = null): SubagentOutputResult {
  return {
    written: false,
    error,
    target: null,
    stats: null,
    previous_stats: null,
    delta: null,
    revision: null,
  };
}

function parseOutputTargetEntry(value: unknown): SubagentOutputTarget {
  if (typeof value !== "object" || value === null) {
    throw new Error("output_target 必须是对象。");
  }
  const entry = value as Record<string, unknown>;
  return {
    domain: parseDocumentDomain(entry.domain, "output_target.domain"),
    id: parseNonEmptyString(entry.id, "output_target.id"),
  };
}

/** Parse optional `output_target` from run_subagent args. */
export function parseOptionalOutputTarget(value: unknown): SubagentOutputTarget | null {
  if (value === undefined || value === null) {
    return null;
  }
  return parseOutputTargetEntry(value);
}

/** Resolve an existing text node and capture revision at subagent start. */
export function captureSubagentOutputTarget(
  worktree: WorktreeSession,
  target: SubagentOutputTarget,
): CapturedSubagentOutputTarget {
  const info = worktree.getTextDocumentInfo(target.domain, target.id);
  return {
    domain: target.domain,
    id: target.id,
    kind: info.kind,
    label: info.label,
    displayPath: info.displayPath,
    expectedRevision: worktree.getDocumentContentRevision(target.domain, target.id),
  };
}

function readDocumentContent(worktree: WorktreeSession, target: SubagentOutputTarget): string {
  return target.domain === "manuscript"
    ? worktree.readChapter(target.id)
    : worktree.readResourceFile(target.id);
}

function writeDocumentContent(
  worktree: WorktreeSession,
  target: SubagentOutputTarget,
  content: string,
): void {
  if (target.domain === "manuscript") {
    worktree.writeChapter(target.id, content);
  } else {
    worktree.writeResourceFile(target.id, content);
  }
}

/**
 * Write subagent final prose to a pre-captured output target.
 * Uses revision captured at subagent start (same semantics as write_document).
 */
export function writeSubagentOutput(
  worktree: WorktreeSession,
  captured: CapturedSubagentOutputTarget,
  content: string,
): SubagentOutputResult {
  const currentRevision = worktree.getDocumentContentRevision(captured.domain, captured.id);
  if (currentRevision !== captured.expectedRevision) {
    return emptyOutputResult(
      `output_target revision 不匹配（expected=${captured.expectedRevision}, current=${currentRevision}）；目标文档在子代理运行期间已被修改。`,
    );
  }

  try {
    const previousContent = readDocumentContent(worktree, captured);
    writeDocumentContent(worktree, captured, content);
    const writeStats = withWriteStats(previousContent, content);
    const revision = worktree.getDocumentContentRevision(captured.domain, captured.id);

    return {
      written: true,
      error: null,
      target: {
        domain: captured.domain,
        id: captured.id,
        kind: captured.kind,
        label: captured.label,
        display_path: captured.displayPath,
      },
      stats: writeStats.stats,
      previous_stats: writeStats.previous_stats,
      delta: writeStats.delta,
      revision,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return emptyOutputResult(message);
  }
}

/** Stats-only helper for tests / summaries when content is known but not written. */
export function computeSubagentOutputStats(content: string): TextStats {
  return computeTextStats(content);
}
