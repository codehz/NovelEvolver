import type { ScmCommitSummary } from "#shared/rpc/worktree-scm-rpc";

import { ScmGraphCommitRow } from "./ScmGraphCommitRow";

function ScmGraphEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-ctp-subtext0">
      <span aria-hidden="true" className="icon-[codicon--history] text-2xl text-ctp-overlay0" />
      <p>此分支尚无提交记录。</p>
    </div>
  );
}

function ScmGraphLoading() {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-ctp-subtext0">
      <span aria-hidden="true" className="icon-[codicon--loading] animate-spin text-2xl" />
      <p>正在加载提交历史…</p>
    </div>
  );
}

function ScmGraphError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-ctp-subtext0">
      <span aria-hidden="true" className="icon-[codicon--error] text-2xl text-ctp-red" />
      <p>无法加载提交历史。</p>
      <button
        type="button"
        className="text-xs text-ctp-mauve underline-offset-2 hover:underline"
        onClick={onRetry}
      >
        重试
      </button>
    </div>
  );
}

function ScmGraphList({ commits }: { commits: ScmCommitSummary[] }) {
  return (
    <div className="py-1">
      <ul className="flex flex-col" role="list">
        {commits.map((commit, index) => (
          <ScmGraphCommitRow
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

export function ScmGraphBody({
  commits,
  error,
  loading,
  onRetry,
}: {
  commits: ScmCommitSummary[] | null;
  error: boolean;
  loading: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return <ScmGraphLoading />;
  }
  if (error) {
    return <ScmGraphError onRetry={onRetry} />;
  }
  if (commits === null || commits.length === 0) {
    return <ScmGraphEmptyState />;
  }
  return <ScmGraphList commits={commits} />;
}
