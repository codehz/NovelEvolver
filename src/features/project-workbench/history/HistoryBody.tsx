import { Button } from "#app/shared/ui";
import type { Change, CommitSummary } from "#shared/rpc/worktree/index";

import { HistoryCommitRow } from "./HistoryCommitRow";
import type { CommitChangesCacheEntry } from "./use-commit-changes-state";

function HistoryEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-ctp-subtext0">
      <span aria-hidden="true" className="icon-[codicon--history] text-2xl text-ctp-overlay0" />
      <p>此分支尚无提交记录。</p>
    </div>
  );
}

function HistoryLoading() {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-ctp-subtext0">
      <span aria-hidden="true" className="icon-[codicon--loading] animate-spin text-2xl" />
      <p>正在加载提交历史…</p>
    </div>
  );
}

function HistoryError({ onRetry }: { onRetry: () => void }) {
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

type HistoryListProps = {
  commits: CommitSummary[];
  expandedHashes: ReadonlySet<string>;
  cache: ReadonlyMap<string, CommitChangesCacheEntry>;
  onToggleCommit: (commitHash: string) => void;
  onRetryCommit: (commitHash: string) => void;
  onOpenChange: (commit: CommitSummary, change: Change) => void;
};

function HistoryList({
  commits,
  expandedHashes,
  cache,
  onToggleCommit,
  onRetryCommit,
  onOpenChange,
}: HistoryListProps) {
  return (
    <div className="py-1">
      <ul className="flex flex-col" role="list">
        {commits.map((commit, index) => (
          <HistoryCommitRow
            key={commit.hash}
            commit={commit}
            isHead={index === 0}
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

type HistoryBodyProps = {
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

export function HistoryBody({
  commits,
  error,
  loading,
  onRetry,
  expandedHashes,
  cache,
  onToggleCommit,
  onRetryCommit,
  onOpenChange,
}: HistoryBodyProps) {
  if (loading) {
    return <HistoryLoading />;
  }
  if (error) {
    return <HistoryError onRetry={onRetry} />;
  }
  if (commits === null || commits.length === 0) {
    return <HistoryEmptyState />;
  }
  return (
    <HistoryList
      commits={commits}
      expandedHashes={expandedHashes}
      cache={cache}
      onToggleCommit={onToggleCommit}
      onRetryCommit={onRetryCommit}
      onOpenChange={onOpenChange}
    />
  );
}
