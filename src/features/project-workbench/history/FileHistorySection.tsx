import { useMolecule } from "bunshi/react";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";

import { notificationApi } from "#app/shared/lib/notifications";
import { cn } from "#app/shared/lib/ui/cn";
import type { HistoryEntry, HistoryTarget } from "#shared/rpc/worktree/index";
import { getWorkbenchEditorTabHistoryTarget } from "#workbench/editor/contributions/registry";
import { workbenchEditorMolecule } from "#workbench/editor/state/molecules";
import { useWorkbenchEditorActions } from "#workbench/editor/use-workbench-editor-actions";
import { formatHistoryTime } from "#workbench/lib/format-history-time";
import { useWorktreeChangesRevision } from "#workbench/session/changes-feed/use-worktree-changes-revision";
import { useHistory } from "#workbench/session/workspace-handles";

const historyRowClass = cn(
  "group flex w-full min-w-0 items-start gap-2 border-b border-titlebar-border p-2 text-left",
  "hover:bg-ctp-surface0/40 focus-visible:bg-ctp-surface0/40 focus-visible:outline-none",
  // Non-content history rows stay fully opaque; only kill hover wash + pointer.
  "disabled:pointer-events-none hover:disabled:bg-transparent",
);

function entryIconClass(entry: HistoryEntry): string {
  if (entry.kind === "delete") {
    return "icon-[codicon--diff-removed]";
  }
  if (entry.kind === "create") {
    return "icon-[codicon--diff-added]";
  }
  if (entry.revisionSource === "commit") {
    return "icon-[codicon--git-commit]";
  }
  if (entry.kind === "content" && entry.source === "journal") {
    return "icon-[codicon--save]";
  }
  return "icon-[codicon--git-commit]";
}

function kindLabel(kind: HistoryEntry["kind"]): string {
  switch (kind) {
    case "create":
      return "创建";
    case "delete":
      return "删除";
    case "rename":
      return "重命名";
    case "move":
      return "移动";
    case "reorder":
      return "排序";
    case "content":
      return "内容";
    case "restore":
      return "恢复";
  }
}

function HistoryEmptyState({ active }: { active: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 px-3 py-8 text-center text-xs text-ctp-subtext0">
      <span aria-hidden="true" className="icon-[codicon--history] text-2xl text-ctp-overlay0" />
      <p>{active ? "当前文件还没有历史记录。" : "打开一个章节或资源文件以查看历史。"}</p>
    </div>
  );
}

export function FileHistorySectionBody() {
  const history = useHistory();
  const revision = useWorktreeChangesRevision();
  const { activeEditorTabAtom } = useMolecule(workbenchEditorMolecule);
  const activeTab = useAtomValue(activeEditorTabAtom);
  const { focusTarget, openTarget } = useWorkbenchEditorActions();
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const target = useMemo<HistoryTarget | null>(() => {
    if (activeTab === undefined) {
      return null;
    }
    return getWorkbenchEditorTabHistoryTarget(activeTab);
  }, [activeTab]);

  useEffect(() => {
    let canceled = false;
    if (target === null) {
      setEntries(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    void Promise.resolve(history.listFileHistory(target, 80))
      .then((result) => {
        if (!canceled) {
          setEntries(result);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (!canceled) {
          notificationApi.error(error instanceof Error ? error.message : "无法加载历史", {
            source: "历史",
          });
          setEntries([]);
          setLoading(false);
        }
      });

    return () => {
      canceled = true;
    };
  }, [history, revision, target]);

  const openPreviewEntry = useCallback(
    (entry: HistoryEntry, intent: "focus" | "open") => {
      if (target === null) {
        return;
      }

      const editorTarget = {
        kind: "history-entry" as const,
        entryId: entry.id,
        sourceTarget: target,
        entryKind: entry.kind,
        label: entry.label,
        message: entry.message,
        timestamp: entry.timestamp,
        shortHash: entry.shortHash,
        displayPath: entry.displayPath,
      };
      if (intent === "focus") {
        focusTarget(editorTarget);
        return;
      }
      openTarget(editorTarget);
    },
    [focusTarget, openTarget, target],
  );

  return (
    <>
      {target === null ? (
        <HistoryEmptyState active={false} />
      ) : loading && entries === null ? (
        <div className="flex flex-col items-center gap-2 px-3 py-8 text-center text-xs text-ctp-subtext0">
          <span aria-hidden="true" className="icon-[codicon--loading] animate-spin text-2xl" />
          <p>正在加载历史…</p>
        </div>
      ) : entries === null || entries.length === 0 ? (
        <HistoryEmptyState active />
      ) : (
        <div className="flex min-w-0 flex-col text-xs">
          {entries.map((entry) => (
            <button
              key={entry.id}
              className={historyRowClass}
              disabled={!entry.hasContent}
              type="button"
              onClick={() => openPreviewEntry(entry, "focus")}
              onDoubleClick={() => openPreviewEntry(entry, "open")}
            >
              <span
                aria-hidden="true"
                className={cn("mt-0.5 shrink-0 text-sm text-ctp-overlay0", entryIconClass(entry))}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-ctp-subtext1" title={entry.message}>
                  {entry.message}
                </p>
                <p className="truncate text-2xs text-ctp-overlay0" title={entry.displayPath}>
                  {kindLabel(entry.kind)}
                  <span className="mx-1 text-ctp-surface2">·</span>
                  {formatHistoryTime(entry.timestamp)}
                  {entry.shortHash ? (
                    <>
                      <span className="mx-1 text-ctp-surface2">·</span>
                      <span className="font-mono">{entry.shortHash}</span>
                    </>
                  ) : null}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
