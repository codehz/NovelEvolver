import { Button } from "#app/shared/ui";
import type { Change, CommitSummary } from "#shared/rpc/worktree/index";

import { HistoryCommitRow } from "./HistoryCommitRow";
import type { CommitChangesCacheEntry } from "./use-commit-changes-state";

function HistoryGraphEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-ctp-subtext0">
      <span aria-hidden="true" className="icon-[codicon--history] text-2xl text-ctp-overlay0" />
      <p>此分支尚无提交记录。</p>
    </div>
  );
}

function HistoryGraphLoading() {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-ctp-subtext0">
      <span aria-hidden="true" className="icon-[codicon--loading] animate-spin text-2xl" />
      <p>正在加载提交历史…</p>
    </div>
  );
}

function HistoryGraphError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-ctp-subtext0">
      <span aria-hidden="true" className="icon-[codicon--error] text-2xl text-ctp-red" />
      <p>无法加载提交历史。</p>
      <Button variant="link" className="text-xs" onClick={onRetry}>
        重试
      </Button>
    </div>
  );
}

type HistoryGraphListProps = {
  commits: CommitSummary[];
  expandedHashes: ReadonlySet<string>;
  cache: ReadonlyMap<string, CommitChangesCacheEntry>;
  onToggleCommit: (commitHash: string) => void;
  onRetryCommit: (commitHash: string) => void;
  onOpenChange: (commit: CommitSummary, change: Change) => void;
};

function HistoryGraphList({
  commits,
  expandedHashes,
  cache,
  onToggleCommit,
  onRetryCommit,
  onOpenChange,
}: HistoryGraphListProps) {
  return (
    <div className="py-1">
      <ul className="flex flex-col" role="list">
        {commits.map((commit, index) => (
          <HistoryCommitRow
            key={commit.hash}
            commit={commit}
            isHead={index === 0}
            showBottomConnector={index < commits.length - 1}
            showTopConnector={index > 0}
            expanded={expandedHashes.has(commit.hash)}
            cacheEntry={cache.get(commit.hash)}
            onToggle={() => onToggleCommit(commit.hash)}
            onRetry={() => onRetryCommit(commit.hash)}
            onOpenChange={(change) => onOpenChange(commit, change)}
          />
        ))}
      </ul>
    </div>
  );
}

type CommitGraphBodyProps = {
  commits: CommitSummary[] | null;
  error: boolean;
  loading: boolean;
  onRetry: () => void;
  expandedHashes: ReadonlySet<string>;
  cache: ReadonlyMap<string, CommitChangesCacheEntry>;
  onToggleCommit: (commitHash: string) => void;
  onRetryCommit: (commitHash: string) => void;
  onOpenChange: (commit: CommitSummary, change: Change) => void;
};

export function CommitGraphBody({
  commits,
  error,
  loading,
  onRetry,
  expandedHashes,
  cache,
  onToggleCommit,
  onRetryCommit,
  onOpenChange,
}: CommitGraphBodyProps) {
  if (loading) {
    return <HistoryGraphLoading />;
  }
  if (error) {
    return <HistoryGraphError onRetry={onRetry} />;
  }
  if (commits === null || commits.length === 0) {
    return <HistoryGraphEmptyState />;
  }
  return (
    <HistoryGraphList
      commits={commits}
      expandedHashes={expandedHashes}
      cache={cache}
      onToggleCommit={onToggleCommit}
      onRetryCommit={onRetryCommit}
      onOpenChange={onOpenChange}
    />
  );
}
