import type {
  WorktreeReplaceFileResult,
  WorktreeReplaceQuery,
  WorktreeReplaceResult,
  WorktreeSearchScope,
} from "@novelevolver/domain/worktree";
import { nanoid } from "nanoid/non-secure";

import type { JournalOperationCapture } from "../journal/journal-types";
import { applyReplacements, compileNeedle } from "../replace";
import { persistAndEmit } from "./persistence";
import type { WorktreeSessionState } from "./state";

type ReplaceCandidate = {
  domain: "manuscript" | "resource";
  nodeId: string;
  label: string;
  displayPath: string;
  entry: { content: string };
};

function emptyResult(
  options: WorktreeReplaceQuery,
  isRegex: boolean,
  revision: number,
): WorktreeReplaceResult {
  return {
    query: options.query,
    replacement: options.replacement,
    isRegex,
    files: [],
    totalReplacements: 0,
    filesUpdated: 0,
    revision,
  };
}

function normalizeScope(scope: WorktreeSearchScope | undefined): WorktreeSearchScope {
  return scope ?? "all";
}

function collectCandidates(
  state: WorktreeSessionState,
  options: WorktreeReplaceQuery,
): ReplaceCandidate[] {
  const targets = options.targets;
  if (targets !== undefined && targets.length > 0) {
    return targets.map((target) => {
      if (target.domain === "manuscript") {
        const entry = state.currentManuscript.entries.get(target.nodeId);
        if (entry === undefined) {
          throw new Error(`手稿节点不存在: ${target.nodeId}`);
        }
        if (entry.type !== "chapter") {
          throw new Error(`手稿节点不是章节: ${target.nodeId}`);
        }
        return {
          domain: "manuscript" as const,
          nodeId: target.nodeId,
          label: entry.title,
          displayPath: entry.displayPath,
          entry,
        };
      }

      const entry = state.currentResources.entries.get(target.nodeId);
      if (entry === undefined) {
        throw new Error(`资源节点不存在: ${target.nodeId}`);
      }
      if (entry.type !== "file") {
        throw new Error(`资源节点不是文件: ${target.nodeId}`);
      }
      return {
        domain: "resource" as const,
        nodeId: target.nodeId,
        label: entry.name,
        displayPath: entry.displayPath,
        entry,
      };
    });
  }

  const scope = normalizeScope(options.scope);
  const candidates: ReplaceCandidate[] = [];

  if (scope === "all" || scope === "manuscript") {
    for (const entry of state.currentManuscript.entries.values()) {
      if (entry.type !== "chapter") {
        continue;
      }
      candidates.push({
        domain: "manuscript",
        nodeId: entry.id,
        label: entry.title,
        displayPath: entry.displayPath,
        entry,
      });
    }
  }

  if (scope === "all" || scope === "resource") {
    for (const entry of state.currentResources.entries.values()) {
      if (entry.type !== "file") {
        continue;
      }
      candidates.push({
        domain: "resource",
        nodeId: entry.id,
        label: entry.name,
        displayPath: entry.displayPath,
        entry,
      });
    }
  }

  return candidates;
}

export function replaceInWorktree(
  state: WorktreeSessionState,
  options: WorktreeReplaceQuery,
): WorktreeReplaceResult {
  const isRegex = options.isRegex === true;
  const needle = compileNeedle(options.query, isRegex);
  if (needle === null) {
    return emptyResult(options, isRegex, state.revision);
  }

  if (options.occurrenceStart !== undefined) {
    if (options.targets === undefined || options.targets.length !== 1) {
      throw new Error("单处替换需要恰好一个目标文件");
    }
  }

  const candidates = collectCandidates(state, options);
  const onlyStart = options.occurrenceStart;
  const operations: JournalOperationCapture[] = [];
  const files: WorktreeReplaceFileResult[] = [];
  let totalReplacements = 0;
  let filesUpdated = 0;

  for (const candidate of candidates) {
    const before = candidate.entry.content;
    const { next, count } = applyReplacements(
      before,
      needle,
      options.replacement,
      onlyStart !== undefined ? { onlyStart } : undefined,
    );

    if (onlyStart !== undefined && count === 0) {
      throw new Error("未找到要替换的匹配项");
    }

    const updated = count > 0 && next !== before;
    if (updated) {
      candidate.entry.content = next;
      operations.push({
        kind: "content",
        domain: candidate.domain,
        entityId: candidate.nodeId,
        entityKind: candidate.domain === "manuscript" ? "chapter" : "file",
        label: candidate.label,
        displayPath: candidate.displayPath,
        beforeContent: before,
        afterContent: next,
      });
      filesUpdated += 1;
    }

    totalReplacements += count;
    files.push({
      domain: candidate.domain,
      nodeId: candidate.nodeId,
      label: candidate.label,
      displayPath: candidate.displayPath,
      matchCount: count,
      updated,
    });
  }

  if (operations.length > 0) {
    const total = totalReplacements;
    persistAndEmit(state, false, {
      source: "search-replace",
      title: total === 1 ? "查找替换" : `查找替换 ${total} 处`,
      groupKey: `search-replace:${nanoid()}`,
      operations,
    });
  }

  return {
    query: options.query,
    replacement: options.replacement,
    isRegex,
    files,
    totalReplacements,
    filesUpdated,
    revision: state.revision,
  };
}
