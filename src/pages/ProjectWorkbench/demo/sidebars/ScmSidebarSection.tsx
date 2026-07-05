import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  SidebarSectionRowResizeHandle,
  SidebarViewSection,
  useSidebarPaneStack,
} from "#app/components/workbench";
import { cn } from "#app/lib/cn";
import type { RpcStreamSubscribe } from "#shared/rpc/stream";
import type { ScmChange, ScmSnapshot } from "#shared/rpc/worktree-scm";

import { useWorktreeScm } from "../branch/branch-scopes";

const DEFAULT_CHANGES_BODY_HEIGHT = 200;
const DEFAULT_GRAPH_BODY_HEIGHT = 120;

function DiffStats({ added, removed }: { added: number; removed: number }) {
  return (
    <span className="shrink-0 font-mono text-[10px] leading-none">
      {added > 0 ? <span className="text-ctp-green">+{added}</span> : null}
      {removed > 0 ? <span className="text-ctp-red"> -{removed}</span> : null}
    </span>
  );
}

// ==================== 单行 DiffItem 渲染 ====================

function consumeRpcStream<T>(
  subscribe: RpcStreamSubscribe<T>,
  onValue: (value: T) => void,
  onError: () => void,
): () => void {
  let canceled = false;
  let abortSubscription: (() => void) | null = null;

  void Promise.resolve(subscribe())
    .then((stream) => {
      if (canceled) {
        void stream.cancel("SCM subscription disposed.").catch(() => undefined);
        return;
      }

      const abortController = new AbortController();
      abortSubscription = () => {
        abortController.abort();
      };

      void stream
        .pipeTo(
          new WritableStream<T>({
            write: (value) => {
              onValue(value);
            },
          }),
          { signal: abortController.signal },
        )
        .catch((error) => {
          if (!canceled && !(error instanceof DOMException && error.name === "AbortError")) {
            onError();
          }
        })
        .finally(() => {
          if (!canceled) {
            abortSubscription = null;
          }
        });
    })
    .catch(() => {
      if (!canceled) {
        onError();
      }
    });

  return () => {
    canceled = true;
    abortSubscription?.();
  };
}

function DiffItemRow({
  item,
  onRevert,
}: {
  item: ScmChange;
  onRevert: (changeId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const kindIcon = cn(
    item.kind === "create" && "icon-[codicon--diff-added] text-ctp-green",
    item.kind === "delete" && "icon-[codicon--diff-removed] text-ctp-red",
    item.kind === "content" && "icon-[codicon--diff-modified] text-ctp-yellow",
    item.kind === "rename" && "icon-[codicon--edit] text-ctp-yellow",
    item.kind === "move" && "icon-[codicon--diff-modified] text-ctp-yellow",
    item.kind === "reorder" && "icon-[codicon--list-flat] text-ctp-subtext0",
  );

  const fileIcon =
    item.entityKind === "folder"
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
              onRevert(item.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onRevert(item.id);
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

function ScmGraphPlaceholder() {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-ctp-subtext0">
      <span aria-hidden="true" className="icon-[codicon--graph] text-2xl text-ctp-overlay0" />
      <p>提交图表（占位）</p>
    </div>
  );
}

function ScmCommitForm({
  commitMessage,
  committing,
  onCommitMessageChange,
  onCommit,
}: {
  commitMessage: string;
  committing: boolean;
  onCommitMessageChange: (value: string) => void;
  onCommit: () => void;
}) {
  return (
    <div className="shrink-0 p-2">
      <textarea
        className="w-full resize-none rounded-sm border border-ctp-surface0 bg-ctp-base px-2 py-1.5 text-xs leading-tight text-ctp-text outline-none placeholder:text-ctp-overlay0 focus:border-ctp-mauve"
        rows={3}
        placeholder="提交信息…"
        value={commitMessage}
        onChange={(e) => onCommitMessageChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onCommit();
          }
        }}
        disabled={committing}
      />
      <button
        type="button"
        className={cn(
          "mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium",
          commitMessage.trim() !== "" && !committing
            ? "bg-ctp-mauve text-ctp-crust hover:brightness-110"
            : "cursor-not-allowed bg-ctp-surface0 text-ctp-overlay0",
        )}
        disabled={commitMessage.trim() === "" || committing}
        onClick={onCommit}
      >
        {committing ? (
          <>
            <span className="icon-[codicon--loading] animate-spin text-sm" />
            提交中…
          </>
        ) : (
          <>
            <span className="icon-[codicon--check] text-sm" />
            提交
          </>
        )}
      </button>
      <p className="mt-1 text-center text-[10px] text-ctp-overlay0">Ctrl+Enter 提交</p>
    </div>
  );
}

function ScmChangesBody({
  commitMessage,
  committing,
  loading,
  error,
  result,
  onCommitMessageChange,
  onCommit,
  onRetry,
  onRevert,
}: {
  commitMessage: string;
  committing: boolean;
  loading: boolean;
  error: boolean;
  result: ScmSnapshot | null;
  onCommitMessageChange: (value: string) => void;
  onCommit: () => void;
  onRetry: () => void;
  onRevert: (changeId: string) => void;
}) {
  let changesContent: ReactNode;

  if (loading) {
    changesContent = <DiffLoading />;
  } else if (error) {
    changesContent = <DiffError onRetry={onRetry} />;
  } else if (result === null) {
    changesContent = <DiffEmptyState />;
  } else if (!result.hasChanges) {
    changesContent = (
      <>
        {result.warning ? (
          <div className="px-2 pt-2">
            <div className="rounded border border-ctp-yellow/40 bg-ctp-yellow/10 px-2 py-1 text-[10px] text-ctp-yellow">
              {result.warning}
            </div>
          </div>
        ) : null}
        <DiffEmptyState />
      </>
    );
  } else {
    changesContent = (
      <div className="flex flex-col gap-0.5 py-1">
        {result.warning ? (
          <div className="mx-2 mb-1 rounded border border-ctp-yellow/40 bg-ctp-yellow/10 px-2 py-1 text-[10px] text-ctp-yellow">
            {result.warning}
          </div>
        ) : null}
        {result.manuscriptChanges.length > 0 ? (
          <section>
            <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-ctp-mauve uppercase">
              <span className="icon-[codicon--symbol-method] shrink-0 text-sm" />
              正文变更
              <span className="ml-0.5 rounded bg-ctp-surface0 px-1 py-px font-mono text-ctp-subtext0">
                {result.manuscriptChanges.length}
              </span>
            </div>
            <ul className="flex flex-col" role="tree">
              {result.manuscriptChanges.map((item) => (
                <DiffItemRow key={item.id} item={item} onRevert={onRevert} />
              ))}
            </ul>
          </section>
        ) : null}
        {result.resourceChanges.length > 0 ? (
          <section>
            <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-ctp-mauve uppercase">
              <span className="icon-[codicon--symbol-file] shrink-0 text-sm" />
              资源变更
              <span className="ml-0.5 rounded bg-ctp-surface0 px-1 py-px font-mono text-ctp-subtext0">
                {result.resourceChanges.length}
              </span>
            </div>
            <ul className="flex flex-col" role="tree">
              {result.resourceChanges.map((item) => (
                <DiffItemRow key={item.id} item={item} onRevert={onRevert} />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col">
      <ScmCommitForm
        commitMessage={commitMessage}
        committing={committing}
        onCommit={onCommit}
        onCommitMessageChange={onCommitMessageChange}
      />
      {changesContent}
    </div>
  );
}

// ==================== Main component ====================

export function ScmSidebarSection() {
  const scmHandle = useWorktreeScm();
  const [result, setResult] = useState<ScmSnapshot | null>(null);
  const [error, setError] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [commitMessage, setCommitMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [changesExpanded, setChangesExpanded] = useState(true);
  const [graphExpanded, setGraphExpanded] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(false);
    return consumeRpcStream(
      () => scmHandle.subscribeSnapshot(),
      (snapshot) => {
        setResult(snapshot);
        setLoading(false);
      },
      () => {
        setError(true);
        setLoading(false);
      },
    );
  }, [scmHandle, retryKey]);

  const handleRevert = useCallback(
    (changeId: string) => {
      scmHandle
        .revertChange(changeId)
        .then((updated) => {
          setResult(updated);
        })
        .catch(() => {
          setError(true);
        });
    },
    [scmHandle],
  );

  const handleCommit = useCallback(() => {
    const message = commitMessage.trim();
    if (message === "" || committing) return;

    setCommitting(true);
    scmHandle
      .commit(message, { name: "NovelEvolver", email: "app@novel-evolver.local" })
      .then((updated) => {
        setResult(updated);
        setCommitMessage("");
        setCommitting(false);
      })
      .catch(() => {
        setCommitting(false);
        setError(true);
      });
  }, [scmHandle, commitMessage, committing]);

  const handleRetry = useCallback(() => {
    setRetryKey((current) => current + 1);
  }, []);

  const panes = useMemo(
    () => [
      {
        id: "changes",
        title: "更改",
        ariaLabel: "更改",
        panelId: "scm-changes-panel",
        expanded: changesExpanded,
        defaultBodyHeight: DEFAULT_CHANGES_BODY_HEIGHT,
        body: (
          <ScmChangesBody
            commitMessage={commitMessage}
            committing={committing}
            error={error}
            loading={loading}
            result={result}
            onCommit={handleCommit}
            onCommitMessageChange={setCommitMessage}
            onRetry={handleRetry}
            onRevert={handleRevert}
          />
        ),
        onToggleExpanded: () => setChangesExpanded((value) => !value),
      },
      {
        id: "graph",
        title: "图表",
        ariaLabel: "图表",
        panelId: "scm-graph-panel",
        expanded: graphExpanded,
        defaultBodyHeight: DEFAULT_GRAPH_BODY_HEIGHT,
        body: <ScmGraphPlaceholder />,
        onToggleExpanded: () => setGraphExpanded((value) => !value),
      },
    ],
    [
      changesExpanded,
      commitMessage,
      committing,
      error,
      graphExpanded,
      handleCommit,
      handleRetry,
      handleRevert,
      loading,
      result,
    ],
  );

  const { stackRef, paneLayouts, resizeHandles, getResizeHandleProps } = useSidebarPaneStack({
    panes,
  });
  const paneTitleMap = useMemo(
    () => Object.fromEntries(panes.map((pane) => [pane.id, pane.title])),
    [panes],
  );

  return (
    <div ref={stackRef} className="-m-2 flex min-h-0 flex-1 flex-col overflow-hidden">
      {panes.map((pane) => {
        const layout = paneLayouts[pane.id];
        const resizeHandle = resizeHandles.find((handle) => handle.anchorPaneId === pane.id);
        const resizeHandleProps = resizeHandle ? getResizeHandleProps(resizeHandle.id) : null;

        return (
          <Fragment key={pane.id}>
            {resizeHandle && resizeHandleProps ? (
              <SidebarSectionRowResizeHandle
                active={resizeHandleProps.active}
                ariaLabel={`调整${paneTitleMap[resizeHandle.upperPaneId]}与${pane.title}区域高度`}
                onPointerDown={resizeHandleProps.onPointerDown}
              />
            ) : null}
            <SidebarViewSection
              ariaLabel={pane.ariaLabel}
              bodyFillsSection={layout?.bodyFillsSection}
              bodyStyle={layout?.bodyStyle}
              expanded={pane.expanded}
              panelId={pane.panelId}
              sectionStyle={layout?.sectionStyle}
              title={pane.title}
              onToggleExpanded={pane.onToggleExpanded}
            >
              {pane.body}
            </SidebarViewSection>
          </Fragment>
        );
      })}
    </div>
  );
}
