import { cn } from "#app/lib/cn";
import type { ScmCommitSummary } from "#shared/rpc/worktree-scm";

import { formatCommitTime } from "./format-commit-time";

const headDotClass = cn("bg-ctp-mauve ring-2 ring-ctp-mauve/30");
const dotClass = cn("bg-ctp-overlay0");

export function ScmGraphCommitRow({
  commit,
  isHead,
}: {
  commit: ScmCommitSummary;
  isHead: boolean;
}) {
  return (
    <li className="relative flex gap-2 px-2 py-1 text-xs">
      <div className="relative flex w-3 shrink-0 justify-center pt-1.5">
        <span
          aria-hidden
          className={cn("size-2 shrink-0 rounded-full", isHead ? headDotClass : dotClass)}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-ctp-subtext1" title={commit.message}>
          {commit.message}
        </p>
        <p className="truncate font-mono text-[10px] text-ctp-overlay0">
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
