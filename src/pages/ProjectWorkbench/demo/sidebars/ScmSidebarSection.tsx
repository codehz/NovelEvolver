import { useCallback, useEffect, useState } from "react";

import { ScrollArea } from "#app/components/ScrollArea";
import { cn } from "#app/lib/cn";
import type { DiffItem, WorktreeDiffResult } from "#shared/rpc/worktree-diff";

import { useWorktreeDiff } from "../branch/branch-scopes";

// ==================== Stats badge ====================

function DiffStats({ added, removed }: { added: number; removed: number }) {
  return (
    <span className="shrink-0 font-mono text-[10px] leading-none">
      {added > 0 ? <span className="text-ctp-green">+{added}</span> : null}
      {removed > 0 ? <span className="text-ctp-red"> -{removed}</span> : null}
    </span>
  );
}

// ==================== 单行 DiffItem 渲染 ====================

function DiffItemRow({ item, onRevert }: { item: DiffItem; onRevert: (revertId: string) => void }) {
  const [hovered, setHovered] = useState(false);

  const kindIcon = cn(
    item.kind === "add" && "icon-[codicon--diff-added] text-ctp-green",
    item.kind === "remove" && "icon-[codicon--diff-removed] text-ctp-red",
    item.kind === "modify" && "icon-[codicon--diff-modified] text-ctp-yellow",
    item.kind === "move" && "icon-[codicon--diff-modified] text-ctp-yellow",
    item.kind === "reorder" && "icon-[codicon--list-flat] text-ctp-subtext0",
  );

  const fileIcon = item.isDir
    ? "icon-[codicon--folder] text-ctp-mauve"
    : "icon-[codicon--file] text-ctp-overlay0";

  return (
    <li
      className="flex h-6 items-center gap-1 rounded px-2 text-xs text-ctp-subtext1 hover:bg-ctp-surface0/50"
      style={{ paddingLeft: `${(item.depth + 1) * 12}px` }}
      role="treeitem"
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className={cn(fileIcon, "shrink-0 text-sm")} />
      <span className="truncate">{item.label}</span>
      {item.kind === "reorder" ? (
        <span className="shrink-0 text-[10px] text-ctp-overlay0">顺序</span>
      ) : null}
      <span className="ml-auto flex shrink-0 items-center gap-1">
        {!hovered && item.stats !== undefined ? (
          <DiffStats added={item.stats.added} removed={item.stats.removed} />
        ) : null}
        {!hovered ? <span className={cn(kindIcon, "shrink-0 text-sm")} /> : null}
        {hovered ? (
          <button
            type="button"
            className="size-5 shrink-0 cursor-pointer items-center justify-center rounded text-ctp-overlay0 hover:bg-ctp-surface1 hover:text-ctp-subtext1"
            onClick={(e) => {
              e.stopPropagation();
              onRevert(item.revertId);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onRevert(item.revertId);
              }
            }}
            title="还原此变更"
          >
            <span className="icon-[codicon--discard] text-sm" />
          </button>
        ) : null}
      </span>
    </li>
  );
}

// ==================== Empty / Loading / Error states ====================

function DiffEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-ctp-subtext0">
      <span aria-hidden="true" className="icon-[codicon--check] text-2xl text-ctp-green" />
      <p>没有变更。</p>
    </div>
  );
}

function DiffLoading() {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-ctp-subtext0">
      <span aria-hidden="true" className="icon-[codicon--loading] animate-spin text-2xl" />
      <p>正在计算差异…</p>
    </div>
  );
}

function DiffError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-ctp-subtext0">
      <span aria-hidden="true" className="icon-[codicon--error] text-2xl text-ctp-red" />
      <p>无法加载差异信息。</p>
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

// ==================== Main component ====================

export function ScmSidebarSection() {
  const diffHandle = useWorktreeDiff();
  const [result, setResult] = useState<WorktreeDiffResult | null>(null);
  const [error, setError] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    diffHandle
      .compute()
      .then((data) => {
        setResult(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [diffHandle]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRevert = useCallback(
    (revertId: string) => {
      diffHandle
        .revert(revertId)
        .then((updated) => {
          setResult(updated);
        })
        .catch(() => {
          // revert 失败时刷新状态
          load();
        });
    },
    [diffHandle, load],
  );

  if (loading) {
    return (
      <ScrollArea className="-m-2 min-h-0 flex-1" fill>
        <DiffLoading />
      </ScrollArea>
    );
  }

  if (error) {
    return (
      <ScrollArea className="-m-2 min-h-0 flex-1" fill>
        <DiffError onRetry={load} />
      </ScrollArea>
    );
  }

  if (result === null) {
    return (
      <ScrollArea className="-m-2 min-h-0 flex-1" fill>
        <DiffEmptyState />
      </ScrollArea>
    );
  }

  const hasChanges = result.manuscript.length > 0 || result.resources.length > 0;

  if (!hasChanges) {
    return (
      <ScrollArea className="-m-2 min-h-0 flex-1" fill>
        <DiffEmptyState />
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="-m-2 min-h-0 flex-1" fill>
      <div className="flex flex-col gap-0.5 py-1">
        {/* 正文变更 */}
        {result.manuscript.length > 0 ? (
          <section>
            <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-ctp-mauve uppercase">
              <span className="icon-[codicon--symbol-method] shrink-0 text-sm" />
              正文变更
              <span className="ml-0.5 rounded bg-ctp-surface0 px-1 py-px font-mono text-ctp-subtext0">
                {result.manuscript.length}
              </span>
            </div>
            <ul className="flex flex-col" role="tree">
              {result.manuscript.map((item) => (
                <DiffItemRow key={item.revertId} item={item} onRevert={handleRevert} />
              ))}
            </ul>
          </section>
        ) : null}

        {/* 资源变更 */}
        {result.resources.length > 0 ? (
          <section>
            <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-ctp-mauve uppercase">
              <span className="icon-[codicon--symbol-file] shrink-0 text-sm" />
              资源变更
              <span className="ml-0.5 rounded bg-ctp-surface0 px-1 py-px font-mono text-ctp-subtext0">
                {result.resources.length}
              </span>
            </div>
            <ul className="flex flex-col" role="tree">
              {result.resources.map((item) => (
                <DiffItemRow key={item.revertId} item={item} onRevert={handleRevert} />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </ScrollArea>
  );
}
