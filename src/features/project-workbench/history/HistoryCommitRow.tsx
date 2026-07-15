import { cn } from "#app/shared/lib/ui/cn";
import { rowHoverClass } from "#app/shared/lib/ui/interaction-chrome";
import { Button, DisclosureChevron } from "#app/shared/ui";
import type { Change, CommitSummary } from "#shared/rpc/worktree/index";
import { activateOnEnterSpace } from "#workbench/lib/activate-on-enter-space";
import { formatCommitTime } from "#workbench/lib/format-history-time";

import { CommitChangesTree } from "./CommitChangesTree";
import { HistoryGraphGlyph } from "./HistoryGraphGlyph";
import type { CommitChangesCacheEntry } from "./use-commit-changes-state";

const commitHeaderClass = cn(
  "grid h-10 cursor-pointer grid-cols-[1rem_minmax(0,1fr)] gap-2 px-2 text-xs outline-none",
  rowHoverClass,
  "focus-visible:bg-ctp-surface0/40",
);

type HistoryCommitRowProps = {
  commit: CommitSummary;
  isHead: boolean;
  showTopConnector: boolean;
  showBottomConnector: boolean;
  expanded: boolean;
  cacheEntry: CommitChangesCacheEntry | undefined;
  onToggle: () => void;
  onRetry: () => void;
  onOpenChange: (change: Change) => void;
};

export function HistoryCommitRow({
  commit,
  isHead,
  showTopConnector,
  showBottomConnector,
  expanded,
  cacheEntry,
  onToggle,
  onRetry,
  onOpenChange,
}: HistoryCommitRowProps) {
  // Rail lives on the full <li> so bottom connector can span expanded children
  // without scaling the node. Continue the line whenever there is a next commit
  // or this row is expanded (so the track does not break above children).
  const continueBottom = showBottomConnector || expanded;

  return (
    <li className="relative">
      <HistoryGraphGlyph
        isHead={isHead}
        showBottomConnector={continueBottom}
        showTopConnector={showTopConnector}
      />
      <div
        className={commitHeaderClass}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={activateOnEnterSpace(onToggle)}
      >
        <div aria-hidden="true" className="w-4" />
        <div className="flex min-w-0 items-start gap-1 py-1">
          <DisclosureChevron expanded={expanded} />
          <div className="min-w-0 flex-1">
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
        </div>
      </div>
      {expanded ? (
        <div className="min-w-0 pb-1 pl-6">
          {cacheEntry === undefined || cacheEntry.status === "loading" ? (
            <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] text-ctp-overlay0">
              <span aria-hidden="true" className="icon-[codicon--loading] animate-spin text-sm" />
              <span>正在加载提交变更…</span>
            </div>
          ) : cacheEntry.status === "error" ? (
            <div className="flex flex-col items-start gap-1 px-2 py-1.5 text-[10px] text-ctp-overlay0">
              <p>{cacheEntry.message}</p>
              <Button variant="link" className="h-auto p-0 text-[10px]" onClick={onRetry}>
                重试
              </Button>
            </div>
          ) : (
            <CommitChangesTree
              manuscriptChanges={cacheEntry.snapshot.manuscriptChanges}
              resourceChanges={cacheEntry.snapshot.resourceChanges}
              onOpenChange={onOpenChange}
            />
          )}
        </div>
      ) : null}
    </li>
  );
}
