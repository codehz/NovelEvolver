import { Button } from "#app/shared/ui";
import type { CommitSummary } from "#shared/rpc/worktree/index";

import { HistoryCommitRow } from "./HistoryCommitRow";

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

function HistoryGraphList({ commits }: { commits: CommitSummary[] }) {
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
};

export function CommitGraphBody({ commits, error, loading, onRetry }: CommitGraphBodyProps) {
  if (loading) {
    return <HistoryGraphLoading />;
  }
  if (error) {
    return <HistoryGraphError onRetry={onRetry} />;
  }
  if (commits === null || commits.length === 0) {
    return <HistoryGraphEmptyState />;
  }
  return <HistoryGraphList commits={commits} />;
}
