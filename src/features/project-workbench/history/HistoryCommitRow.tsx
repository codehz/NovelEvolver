import { cn } from "#app/shared/lib/ui/cn";
import { rowHoverClass } from "#app/shared/lib/ui/interaction-chrome";
import { AppTooltip, Button, DisclosureChevron } from "#app/shared/ui";
import type { Change, CommitSummary } from "#shared/rpc/worktree/index";
import { activateOnEnterSpace } from "#workbench/lib/activate-on-enter-space";
import { formatCommitTime } from "#workbench/lib/format-history-time";
import { TREE_ROW_HEIGHT_PX, getTreeRowPaddingLeft } from "#workbench/tree/tree-row-motion";

import { CommitChangesTree } from "./CommitChangesTree";
import type { CommitChangesCacheEntry } from "./use-commit-changes-state";

const commitHeaderClass = cn(
  "flex cursor-pointer items-center gap-1 pr-2 text-xs text-ctp-subtext1 outline-none",
  rowHoverClass,
  "focus-visible:bg-ctp-surface0/40",
);
const headDotClass = cn("size-1.5 shrink-0 rounded-full bg-ctp-mauve");
const expandedContentClass = cn("min-w-0 pb-1");
const expandedStatusClass = cn("flex items-center gap-2 py-1.5 text-[10px] text-ctp-overlay0");
const expandedErrorClass = cn(
  "flex flex-col items-start gap-1 py-1.5 text-[10px] text-ctp-overlay0",
);

type HistoryCommitRowProps = {
  commit: CommitSummary;
  isHead: boolean;
  expanded: boolean;
  cacheEntry: CommitChangesCacheEntry | undefined;
  onToggle: () => void;
  onRetry: () => void;
  onOpenChange: (change: Change) => void;
};

function commitMetaLabel(commit: CommitSummary): string {
  return `${commit.shortHash} · ${formatCommitTime(commit.committedAt)} · ${commit.authorName}`;
}

export function HistoryCommitRow({
  commit,
  isHead,
  expanded,
  cacheEntry,
  onToggle,
  onRetry,
  onOpenChange,
}: HistoryCommitRowProps) {
  return (
    <li>
      <AppTooltip label={commitMetaLabel(commit)} side="right">
        <div
          className={commitHeaderClass}
          style={{ height: TREE_ROW_HEIGHT_PX, paddingLeft: getTreeRowPaddingLeft(0) }}
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          aria-label={`${commit.message}. ${commitMetaLabel(commit)}`}
          onClick={onToggle}
          onKeyDown={activateOnEnterSpace(onToggle)}
        >
          <DisclosureChevron expanded={expanded} />
          {isHead ? <span aria-hidden="true" className={headDotClass} /> : null}
          <span className="min-w-0 flex-1 truncate leading-none">{commit.message}</span>
        </div>
      </AppTooltip>
      {expanded ? (
        <div className={expandedContentClass}>
          {cacheEntry === undefined || cacheEntry.status === "loading" ? (
            <div className={expandedStatusClass} style={{ paddingLeft: getTreeRowPaddingLeft(1) }}>
              <span aria-hidden="true" className="icon-[codicon--loading] animate-spin text-sm" />
              <span>正在加载提交变更…</span>
            </div>
          ) : cacheEntry.status === "error" ? (
            <div className={expandedErrorClass} style={{ paddingLeft: getTreeRowPaddingLeft(1) }}>
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
              baseDepth={1}
            />
          )}
        </div>
      ) : null}
    </li>
  );
}
