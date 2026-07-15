import { cn } from "#app/shared/lib/ui/cn";
import { rowHoverClass } from "#app/shared/lib/ui/interaction-chrome";
import { AppTooltip, DisclosureChevron } from "#app/shared/ui";
import type { CommitSummary } from "#shared/rpc/worktree/index";
import { activateOnEnterSpace } from "#workbench/lib/activate-on-enter-space";
import { formatCommitTime } from "#workbench/lib/format-history-time";
import type { TreeRowLayout } from "#workbench/tree/tree-row-layout";
import { TreeMotionRow } from "#workbench/tree/TreeMotionRow";

const commitRowClass = cn(
  "cursor-pointer text-xs text-ctp-subtext1 outline-none",
  rowHoverClass,
  "focus-visible:bg-ctp-surface0/40",
);
const headDotClass = cn("size-1.5 shrink-0 rounded-full bg-ctp-mauve");
const commitMessageClass = cn("min-w-0 flex-1 truncate leading-none");

type HistoryCommitRowProps = {
  commit: CommitSummary;
  isHead: boolean;
  expanded: boolean;
  layout: TreeRowLayout;
  onToggle: () => void;
};

function commitMetaLabel(commit: CommitSummary): string {
  return `${commit.shortHash} · ${formatCommitTime(commit.committedAt)} · ${commit.authorName}`;
}

export function HistoryCommitRow({
  commit,
  isHead,
  expanded,
  layout,
  onToggle,
}: HistoryCommitRowProps) {
  return (
    <TreeMotionRow
      layout={layout}
      depth={0}
      className={commitRowClass}
      aria-expanded={expanded}
      aria-label={`${commit.message}. ${commitMetaLabel(commit)}`}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={activateOnEnterSpace(onToggle)}
    >
      <DisclosureChevron expanded={expanded} />
      {isHead ? <span aria-hidden="true" className={headDotClass} /> : null}
      <AppTooltip label={commitMetaLabel(commit)} side="right">
        <span className={commitMessageClass}>{commit.message}</span>
      </AppTooltip>
    </TreeMotionRow>
  );
}
