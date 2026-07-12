import { walkLogEntries } from "nano-git/log";

import type {
  CommitSummary,
  HistoryEntry,
  HistoryEntryContent,
  HistoryTarget,
} from "#shared/rpc/worktree/index";

import type { WorktreeJournalEntryRecord } from "../../db/repositories/worktree-repo";
import { journalHistoryEntryId, parseJournalHistoryEntryId } from "../journal/journal-types";
import { persistAndEmit } from "./persistence";
import type { WorktreeSessionState } from "./state";

export function journalEntryToHistoryEntry(
  state: WorktreeSessionState,
  entry: WorktreeJournalEntryRecord,
): HistoryEntry {
  return {
    id: journalHistoryEntryId(entry.entryId),
    source: "journal",
    revisionSource: entry.source,
    actor: entry.actor,
    kind: entry.kind,
    domain: entry.domain,
    entityId: entry.entityId,
    label: entry.label,
    displayPath: entry.displayPath,
    timestamp: entry.updatedAt,
    message: entry.title,
    stats:
      entry.statsAdded === null || entry.statsRemoved === null
        ? undefined
        : { added: entry.statsAdded, removed: entry.statsRemoved },
    commitHash: entry.commitHash ?? undefined,
    shortHash: entry.commitHash?.slice(0, 7),
    revisionId: entry.entryId,
    groupId: entry.groupKey ?? undefined,
    hasContent: entry.afterContent !== null,
  };
}

export function listBranchCommits(state: WorktreeSessionState, maxCount = 50): CommitSummary[] {
  const tip = state.repo.readBranch(state.branchName);
  if (tip === null) {
    return [];
  }

  const commits: CommitSummary[] = [];
  for (const entry of walkLogEntries(state.objects, { from: [tip], maxCount })) {
    const subject = entry.commit.message.split("\n")[0]?.trim() ?? "";
    commits.push({
      hash: entry.hash,
      shortHash: entry.hash.slice(0, 7),
      message: subject === "" ? "(无提交说明)" : subject,
      authorName: entry.commit.author.name,
      committedAt: entry.commit.committer.timestamp,
    });
  }
  return commits;
}

export function listFileHistory(
  state: WorktreeSessionState,
  target: HistoryTarget,
  limit = 50,
): HistoryEntry[] {
  const boundedLimit = Math.max(1, Math.min(limit, 200));
  return state.store
    .readJournalHistoryEntries(
      state.projectId,
      state.branchName,
      target.domain,
      target.entityId,
      boundedLimit,
    )
    .map((entry) => journalEntryToHistoryEntry(state, entry));
}

export function readHistoryEntryContent(
  state: WorktreeSessionState,
  entryId: string,
): HistoryEntryContent {
  const journalEntryId = parseJournalHistoryEntryId(entryId);
  if (journalEntryId !== null) {
    const entry = state.store.getJournalHistoryEntry(
      state.projectId,
      state.branchName,
      journalEntryId,
    );
    if (entry === null) {
      throw new Error(`Unknown journal history entry: ${entryId}`);
    }
    return {
      content: entry.afterContent?.toString("utf-8") ?? null,
      beforeContent: entry.beforeContent?.toString("utf-8") ?? null,
    };
  }

  throw new Error(`Unknown history entry: ${entryId}`);
}

export function readHistoryEntry(state: WorktreeSessionState, entryId: string): HistoryEntry {
  const journalEntryId = parseJournalHistoryEntryId(entryId);
  if (journalEntryId === null) throw new Error(`Unknown history entry: ${entryId}`);
  const entry = state.store.getJournalHistoryEntry(
    state.projectId,
    state.branchName,
    journalEntryId,
  );
  if (entry === null) throw new Error(`Unknown journal history entry: ${entryId}`);
  return journalEntryToHistoryEntry(state, entry);
}

export function restoreHistoryEntryContentHunk(
  state: WorktreeSessionState,
  entryId: string,
  expectedContent: string,
  nextContent: string,
): void {
  const journalEntryId = parseJournalHistoryEntryId(entryId);
  if (journalEntryId === null) {
    throw new Error(`Unknown history entry: ${entryId}`);
  }

  const historyEntry = state.store.getJournalHistoryEntry(
    state.projectId,
    state.branchName,
    journalEntryId,
  );
  if (historyEntry === null) {
    throw new Error(`Unknown journal history entry: ${entryId}`);
  }
  if (historyEntry.afterContent === null) {
    throw new Error("此记录没有可恢复内容。");
  }

  if (historyEntry.domain === "manuscript") {
    const entry = state.currentManuscript.entries.get(historyEntry.entityId);
    if (entry?.type !== "chapter") {
      throw new Error(`Manuscript chapter is missing: ${historyEntry.entityId}`);
    }
    if (entry.content !== expectedContent) {
      throw new Error("当前内容已变化，请重新打开历史预览后再试。");
    }
    if (entry.content === nextContent) {
      return;
    }
    entry.content = nextContent;
    persistAndEmit(state, false, {
      source: "restore",
      title: "局部恢复",
      groupKey: `restore:hunk:${historyEntry.domain}:${historyEntry.entityId}`,
      operations: [
        {
          kind: "restore",
          domain: historyEntry.domain,
          entityId: historyEntry.entityId,
          entityKind: "chapter",
          label: entry.title,
          displayPath: entry.displayPath,
          beforeContent: expectedContent,
          afterContent: nextContent,
        },
      ],
    });
    return;
  }

  const entry = state.currentResources.entries.get(historyEntry.entityId);
  if (entry?.type !== "file") {
    throw new Error(`Resource file is missing: ${historyEntry.entityId}`);
  }
  if (entry.content !== expectedContent) {
    throw new Error("当前内容已变化，请重新打开历史预览后再试。");
  }
  if (entry.content === nextContent) {
    return;
  }
  entry.content = nextContent;
  persistAndEmit(state, false, {
    source: "restore",
    title: "局部恢复",
    groupKey: `restore:hunk:${historyEntry.domain}:${historyEntry.entityId}`,
    operations: [
      {
        kind: "restore",
        domain: historyEntry.domain,
        entityId: historyEntry.entityId,
        entityKind: "file",
        label: entry.name,
        displayPath: entry.displayPath,
        beforeContent: expectedContent,
        afterContent: nextContent,
      },
    ],
  });
}
