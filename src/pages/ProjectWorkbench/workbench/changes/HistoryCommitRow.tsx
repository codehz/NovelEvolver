import type { CommitSummary } from "#shared/rpc/history-rpc";

import { formatCommitTime } from "./format-commit-time";
import { HistoryGraphGlyph } from "./HistoryGraphGlyph";

export function HistoryCommitRow({
  commit,
  isHead,
  showTopConnector,
  showBottomConnector,
}: {
  commit: CommitSummary;
  isHead: boolean;
  showTopConnector: boolean;
  showBottomConnector: boolean;
}) {
  return (
    <li className="relative grid h-10 grid-cols-[1rem_minmax(0,1fr)] gap-2 px-2 text-xs">
      <div className="pointer-events-none absolute inset-y-0 left-2 w-4">
        <HistoryGraphGlyph
          isHead={isHead}
          showBottomConnector={showBottomConnector}
          showTopConnector={showTopConnector}
        />
      </div>
      <div aria-hidden="true" className="w-4" />
      <div className="min-w-0 py-1">
        <p className="truncate leading-4 text-ctp-subtext1" title={commit.message}>
          {commit.message}
        </p>
        <p className="truncate font-mono text-[10px] leading-4 text-ctp-overlay0">
          {commit.shortHash}
          <span className="mx-1 text-ctp-surface2">·</span>
          {formatCommitTime(commit.committedAt)}
          <span className="mx-1 text-ctp-surface2">·</span>
          {commit.authorName}
        </p>
      </div>
    </li>
  );
}
