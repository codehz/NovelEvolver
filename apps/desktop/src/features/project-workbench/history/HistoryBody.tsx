import type { Change, CommitSummary } from "@novelevolver/domain/worktree";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

import {
  SidebarHeaderActionButton,
  SidebarHeaderActions,
} from "#app/features/project-workbench/chrome";
import { activateOnEnterSpace } from "#app/features/project-workbench/lib/activate-on-enter-space";
import { ChangesDomainRow } from "#app/features/project-workbench/lib/ChangesDomainRow";
import { ChangeStatsBadge } from "#app/features/project-workbench/lib/ChangeStatsBadge";
import {
  contentEntityIconClass,
  contentFolderIconClass,
} from "#app/features/project-workbench/tree/content-tree-icons";
import { FlatTreeList } from "#app/features/project-workbench/tree/FlatTreeList";
import type { TreeRowLayout } from "#app/features/project-workbench/tree/tree-row-layout";
import {
  TREE_ROW_HEIGHT_PX,
  getTreeRowPaddingLeft,
  treeRowDisclosureSpacerClass,
} from "#app/features/project-workbench/tree/tree-row-motion";
import { TreeMotionRow } from "#app/features/project-workbench/tree/TreeMotionRow";
import { notificationApi } from "#app/shared/lib/notifications";
import { popupContextMenu } from "#app/shared/lib/shell/popup-context-menu";
import { cn } from "#app/shared/lib/ui/cn";
import { rowHoverClass } from "#app/shared/lib/ui/interaction-chrome";
import { Button, DisclosureChevron } from "#app/shared/ui";

import {
  buildHistoryChangeContextMenuItems,
  buildHistoryCommitContextMenuItems,
} from "./history-commit-context-menu";
import {
  collectCommitExpansionSeedKeys,
  flattenHistoryTree,
  historyDomainScopeKey,
  historyFolderScopeKey,
  type HistoryFlatRow,
} from "./history-tree-projector";
import { HistoryCommitRow } from "./HistoryCommitRow";
import type { CommitChangesCacheEntry } from "./use-commit-changes-state";
import { useGitPull } from "./use-git-pull";
import { useGitPush } from "./use-git-push";
import { useRestoreFromHistory } from "./use-restore-from-history";

const changeFolderRowClass = cn(
  "cursor-pointer text-xs text-ctp-subtext1 hover:bg-ctp-surface0/50",
);
const changeFolderCountClass = cn(
  "ml-auto shrink-0 bg-ctp-surface0 px-1 py-px font-mono text-[10px] text-ctp-subtext0",
);
const changeRowClass = cn("group cursor-default text-xs text-ctp-subtext1", rowHoverClass);
const changeMetaClass = cn("ml-auto flex shrink-0 items-center gap-1");
const statusRowClass = cn("text-[10px] text-ctp-overlay0");

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

function changeKindIconClass(kind: Change["kind"]): string {
  return cn(
    kind === "create" && "icon-[codicon--diff-added] text-ctp-green",
    kind === "delete" && "icon-[codicon--diff-removed] text-ctp-red",
    kind === "content" && "icon-[codicon--diff-modified] text-ctp-yellow",
    kind === "rename" && "icon-[codicon--edit] text-ctp-yellow",
    kind === "move" && "icon-[codicon--diff-modified] text-ctp-yellow",
    kind === "reorder" && "icon-[codicon--list-flat] text-ctp-subtext0",
  );
}

function isPreviewableChange(change: Change): boolean {
  return (
    (change.kind === "create" || change.kind === "delete" || change.kind === "content") &&
    (change.entityKind === "chapter" || change.entityKind === "file")
  );
}

function folderIconClass(
  node: Extract<HistoryFlatRow, { kind: "folder" }>["node"],
  expanded: boolean,
): string {
  return contentFolderIconClass(expanded || node.children.length > 0);
}

function HistoryStatusRow({
  row,
  layout,
  onRetry,
}: {
  row: Extract<HistoryFlatRow, { kind: "status" }>;
  layout: TreeRowLayout;
  onRetry: (commitHash: string) => void;
}) {
  if (row.status === "loading") {
    return (
      <TreeMotionRow layout={layout} depth={row.depth} className={statusRowClass}>
        <span className={treeRowDisclosureSpacerClass} />
        <span aria-hidden="true" className="icon-[codicon--loading] animate-spin text-sm" />
        <span>正在加载提交变更…</span>
      </TreeMotionRow>
    );
  }

  if (row.status === "error") {
    return (
      <TreeMotionRow layout={layout} depth={row.depth} className={statusRowClass}>
        <span className={treeRowDisclosureSpacerClass} />
        <span className="min-w-0 flex-1 truncate">{row.message ?? "无法加载提交变更"}</span>
        <Button
          variant="link"
          className="h-auto shrink-0 p-0 text-[10px]"
          onClick={() => onRetry(row.commitHash)}
        >
          重试
        </Button>
      </TreeMotionRow>
    );
  }

  return (
    <TreeMotionRow layout={layout} depth={row.depth} className={statusRowClass}>
      <span className={treeRowDisclosureSpacerClass} />
      <span>此提交无文件变更。</span>
    </TreeMotionRow>
  );
}

function HistoryChangeItemRow({
  item,
  depth,
  layout,
  label,
  disclosure,
  iconClassName,
  className,
  ariaExpanded,
  onClick,
  onKeyDown,
  onContextMenu,
}: {
  item: Change;
  depth: number;
  layout: TreeRowLayout;
  label?: string;
  disclosure?: ReactNode;
  iconClassName?: string;
  className?: string;
  ariaExpanded?: boolean;
  onClick?: () => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  onContextMenu?: (event: ReactMouseEvent) => void;
}) {
  return (
    <TreeMotionRow
      layout={layout}
      depth={depth}
      className={cn(changeRowClass, className)}
      aria-expanded={ariaExpanded}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onContextMenu={
        onContextMenu === undefined
          ? undefined
          : (event) => {
              event.preventDefault();
              event.stopPropagation();
              onContextMenu(event);
            }
      }
    >
      {disclosure ?? <span className={treeRowDisclosureSpacerClass} />}
      <span className={iconClassName ?? contentEntityIconClass(item.entityKind)} />
      <span className="truncate">{label ?? item.label}</span>
      {item.kind === "reorder" ? (
        <span className="shrink-0 text-[10px] text-ctp-overlay0">顺序</span>
      ) : null}
      <span className={changeMetaClass}>
        {item.stats !== undefined ? (
          <ChangeStatsBadge added={item.stats.added} removed={item.stats.removed} />
        ) : null}
        <span className={cn(changeKindIconClass(item.kind), "shrink-0 text-sm")} />
      </span>
    </TreeMotionRow>
  );
}

function HistoryChangeFolderRow({
  row,
  layout,
  onToggle,
  onOpenChange,
  onChangeContextMenu,
}: {
  row: Extract<HistoryFlatRow, { kind: "folder" }>;
  layout: TreeRowLayout;
  onToggle: (commitHash: string, folderKey: string) => void;
  onOpenChange: (commitHash: string, change: Change) => void;
  onChangeContextMenu: (event: ReactMouseEvent, commitHash: string, change: Change) => void;
}) {
  const hasChildren = row.childCount > 0;
  const toggle = () => {
    if (hasChildren) {
      onToggle(row.commitHash, row.folderKey);
    }
  };

  if (row.inlineChange !== null) {
    const previewable = isPreviewableChange(row.inlineChange);
    return (
      <HistoryChangeItemRow
        item={row.inlineChange}
        depth={row.depth}
        layout={layout}
        label={row.node.segment}
        disclosure={
          hasChildren ? (
            <DisclosureChevron expanded={row.expanded} />
          ) : (
            <span className={treeRowDisclosureSpacerClass} />
          )
        }
        iconClassName={folderIconClass(row.node, row.expanded)}
        className={hasChildren || previewable ? cn("cursor-pointer") : undefined}
        ariaExpanded={hasChildren ? row.expanded : undefined}
        onClick={
          hasChildren
            ? toggle
            : previewable
              ? () => onOpenChange(row.commitHash, row.inlineChange!)
              : undefined
        }
        onKeyDown={
          hasChildren
            ? activateOnEnterSpace(toggle)
            : previewable
              ? activateOnEnterSpace(() => onOpenChange(row.commitHash, row.inlineChange!))
              : undefined
        }
        onContextMenu={(event) => onChangeContextMenu(event, row.commitHash, row.inlineChange!)}
      />
    );
  }

  return (
    <TreeMotionRow
      layout={layout}
      depth={row.depth}
      paddingLeftPx={getTreeRowPaddingLeft(row.depth)}
      className={changeFolderRowClass}
      aria-expanded={hasChildren ? row.expanded : undefined}
      tabIndex={0}
      onClick={hasChildren ? toggle : undefined}
      onKeyDown={hasChildren ? activateOnEnterSpace(toggle) : undefined}
    >
      {hasChildren ? (
        <DisclosureChevron expanded={row.expanded} />
      ) : (
        <span className={treeRowDisclosureSpacerClass} />
      )}
      <span className={folderIconClass(row.node, row.expanded)} />
      <span className="truncate">{row.node.segment}</span>
      <span className={changeFolderCountClass}>{row.childCount}</span>
    </TreeMotionRow>
  );
}

type HistoryListProps = {
  commits: CommitSummary[];
  expandedHashes: ReadonlySet<string>;
  cache: ReadonlyMap<string, CommitChangesCacheEntry>;
  onToggleCommit: (commitHash: string) => void;
  onRetryCommit: (commitHash: string) => void;
  onOpenChange: (commit: CommitSummary, change: Change) => void;
  onCreateBranchFromCommit: (commit: CommitSummary) => void;
};

function HistoryList({
  commits,
  expandedHashes,
  cache,
  onToggleCommit,
  onRetryCommit,
  onOpenChange,
  onCreateBranchFromCommit,
}: HistoryListProps) {
  const { restoreWorkingTreeFromCommit, restoreEntityFromCommit, copyCommitHash } =
    useRestoreFromHistory();
  const [expandedDomainKeys, setExpandedDomainKeys] = useState<Set<string>>(() => new Set());
  const [expandedFolderKeys, setExpandedFolderKeys] = useState<Set<string>>(() => new Set());
  const seededCommitsRef = useRef<Set<string>>(new Set());
  const commitByHash = useMemo(() => {
    const map = new Map<string, CommitSummary>();
    for (const commit of commits) {
      map.set(commit.hash, commit);
    }
    return map;
  }, [commits]);

  useEffect(() => {
    seededCommitsRef.current = new Set();
    setExpandedDomainKeys(new Set());
    setExpandedFolderKeys(new Set());
  }, [commits]);

  useEffect(() => {
    const domainAdds: string[] = [];
    const folderAdds: string[] = [];
    for (const commitHash of expandedHashes) {
      if (seededCommitsRef.current.has(commitHash)) {
        continue;
      }
      const entry = cache.get(commitHash);
      if (entry === undefined || entry.status !== "ready") {
        continue;
      }
      const seed = collectCommitExpansionSeedKeys(
        commitHash,
        entry.snapshot.manuscriptChanges,
        entry.snapshot.resourceChanges,
      );
      domainAdds.push(...seed.domainKeys);
      folderAdds.push(...seed.folderKeys);
      seededCommitsRef.current.add(commitHash);
    }
    if (domainAdds.length > 0) {
      setExpandedDomainKeys((current) => {
        const next = new Set(current);
        for (const key of domainAdds) {
          next.add(key);
        }
        return next;
      });
    }
    if (folderAdds.length > 0) {
      setExpandedFolderKeys((current) => {
        const next = new Set(current);
        for (const key of folderAdds) {
          next.add(key);
        }
        return next;
      });
    }
  }, [cache, expandedHashes]);

  const flatRows = useMemo(
    () =>
      flattenHistoryTree(commits, expandedHashes, cache, expandedDomainKeys, expandedFolderKeys),
    [cache, commits, expandedDomainKeys, expandedFolderKeys, expandedHashes],
  );

  const onToggleDomain = useCallback((commitHash: string, domainKey: string) => {
    const key = historyDomainScopeKey(commitHash, domainKey);
    setExpandedDomainKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const onToggleFolder = useCallback((commitHash: string, folderKey: string) => {
    const key = historyFolderScopeKey(commitHash, folderKey);
    setExpandedFolderKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleOpenChange = useCallback(
    (commitHash: string, change: Change) => {
      const commit = commitByHash.get(commitHash);
      if (commit === undefined) {
        return;
      }
      onOpenChange(commit, change);
    },
    [commitByHash, onOpenChange],
  );

  const handleCommitContextMenu = useCallback(
    (event: ReactMouseEvent, commit: CommitSummary) => {
      void (async () => {
        const actionId = await popupContextMenu(buildHistoryCommitContextMenuItems(), {
          x: event.clientX,
          y: event.clientY,
        });
        if (actionId === "create-branch") {
          onCreateBranchFromCommit(commit);
          return;
        }
        if (actionId === "restore-working-tree") {
          await restoreWorkingTreeFromCommit(commit);
          return;
        }
        if (actionId === "copy-hash") {
          await copyCommitHash(commit);
        }
      })();
    },
    [copyCommitHash, onCreateBranchFromCommit, restoreWorkingTreeFromCommit],
  );

  const handleChangeContextMenu = useCallback(
    (event: ReactMouseEvent, commitHash: string, change: Change) => {
      void (async () => {
        const commit = commitByHash.get(commitHash);
        if (commit === undefined) {
          return;
        }
        const actionId = await popupContextMenu(buildHistoryChangeContextMenuItems(), {
          x: event.clientX,
          y: event.clientY,
        });
        if (actionId === "open-diff") {
          if (isPreviewableChange(change)) {
            onOpenChange(commit, change);
          }
          return;
        }
        if (actionId === "restore-entity") {
          if (change.entityKind !== "chapter" && change.entityKind !== "file") {
            notificationApi.error("只能恢复章节或资源文件。", { source: "历史" });
            return;
          }
          await restoreEntityFromCommit(
            commit,
            { domain: change.domain, entityId: change.entityId },
            change.label,
          );
        }
      })();
    },
    [commitByHash, onOpenChange, restoreEntityFromCommit],
  );

  const getItemKey = useCallback((row: HistoryFlatRow) => row.key, []);

  return (
    <div className="py-1">
      <FlatTreeList
        items={flatRows}
        getItemKey={getItemKey}
        rowHeight={TREE_ROW_HEIGHT_PX}
        className="w-full"
        renderRow={(row, _index, layout) => {
          if (row.kind === "commit") {
            return (
              <HistoryCommitRow
                commit={row.commit}
                isHead={row.isHead}
                expanded={row.expanded}
                layout={layout}
                onToggle={() => onToggleCommit(row.commit.hash)}
                onContextMenu={(event) => handleCommitContextMenu(event, row.commit)}
              />
            );
          }
          if (row.kind === "status") {
            return <HistoryStatusRow row={row} layout={layout} onRetry={onRetryCommit} />;
          }
          if (row.kind === "domain") {
            return (
              <ChangesDomainRow
                title={row.title}
                iconClass={row.iconClass}
                expanded={row.expanded}
                childCount={row.childCount}
                depth={row.depth}
                layout={layout}
                onToggle={() => onToggleDomain(row.commitHash, row.domainKey)}
              />
            );
          }
          if (row.kind === "folder") {
            return (
              <HistoryChangeFolderRow
                row={row}
                layout={layout}
                onToggle={onToggleFolder}
                onOpenChange={handleOpenChange}
                onChangeContextMenu={handleChangeContextMenu}
              />
            );
          }
          return (
            <HistoryChangeItemRow
              item={row.item}
              depth={row.depth}
              layout={layout}
              onClick={
                isPreviewableChange(row.item)
                  ? () => handleOpenChange(row.commitHash, row.item)
                  : undefined
              }
              onKeyDown={
                isPreviewableChange(row.item)
                  ? activateOnEnterSpace(() => handleOpenChange(row.commitHash, row.item))
                  : undefined
              }
              onContextMenu={(event) => handleChangeContextMenu(event, row.commitHash, row.item)}
              className={isPreviewableChange(row.item) ? cn("cursor-pointer") : undefined}
            />
          );
        }}
      />
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
  onCreateBranchFromCommit: (commit: CommitSummary) => void;
  /** Called after local history tip may have changed (e.g. pull). */
  onHistoryMutated?: () => void;
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
  onCreateBranchFromCommit,
  onHistoryMutated,
}: HistoryBodyProps) {
  const { pushing, push } = useGitPush();
  const { pulling, pull } = useGitPull({ onSuccess: onHistoryMutated });
  const busy = pushing || pulling;

  let body = null;
  if (loading) {
    body = <HistoryLoading />;
  } else if (error) {
    body = <HistoryError onRetry={onRetry} />;
  } else if (commits === null || commits.length === 0) {
    body = <HistoryEmptyState />;
  } else {
    body = (
      <HistoryList
        commits={commits}
        expandedHashes={expandedHashes}
        cache={cache}
        onToggleCommit={onToggleCommit}
        onRetryCommit={onRetryCommit}
        onOpenChange={onOpenChange}
        onCreateBranchFromCommit={onCreateBranchFromCommit}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-col">
      <SidebarHeaderActions>
        <SidebarHeaderActionButton
          label={pulling ? "拉取中…" : "拉取当前分支（Shift+点击可改远程）"}
          icon={pulling ? "icon-[codicon--loading] animate-spin" : "icon-[codicon--repo-pull]"}
          disabled={busy}
          onClick={(event) => {
            void pull({ forcePromptRemote: event.shiftKey });
          }}
        />
        <SidebarHeaderActionButton
          label={pushing ? "推送中…" : "推送当前分支（Shift+点击可改远程）"}
          icon={pushing ? "icon-[codicon--loading] animate-spin" : "icon-[codicon--repo-push]"}
          disabled={busy}
          onClick={(event) => {
            void push({ forcePromptRemote: event.shiftKey });
          }}
        />
      </SidebarHeaderActions>
      {body}
    </div>
  );
}
