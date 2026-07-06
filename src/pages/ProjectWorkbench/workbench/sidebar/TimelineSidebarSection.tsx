import { useMolecule } from "bunshi/react";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "#app/lib/cn";
import { notificationApi } from "#app/lib/notifications";
import type { TimelineEntry, TimelineTarget } from "#shared/rpc/worktree-timeline-rpc";

import { useWorktreeTimeline } from "../branch/branch-scopes";
import { useWorktreeScmRevision } from "../branch/use-worktree-scm-revision";
import { workbenchEditorMolecule } from "../state/molecules";

const timelineRowClass = cn(
  "group flex w-full min-w-0 flex-col gap-1 border-b border-titlebar-border p-2 text-left",
  "hover:bg-ctp-surface0/40",
);

const timelineButtonClass = cn(
  "inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-2xs text-ctp-mauve",
  "hover:bg-ctp-text/8 disabled:pointer-events-none disabled:text-ctp-overlay0",
);

const previewClass = cn(
  "max-h-52 overflow-auto rounded-sm bg-app-background p-2 whitespace-pre-wrap",
  "font-mono text-2xs leading-4 text-app-foreground",
);

function formatTimelineTime(timestampMs: number): string {
  const date = new Date(timestampMs);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hours}:${minutes}`;
}

function entryIconClass(entry: TimelineEntry): string {
  if (entry.source === "local-snapshot") {
    return "icon-[codicon--save]";
  }
  if (entry.kind === "delete") {
    return "icon-[codicon--diff-removed]";
  }
  if (entry.kind === "create") {
    return "icon-[codicon--diff-added]";
  }
  return "icon-[codicon--git-commit]";
}

function kindLabel(kind: TimelineEntry["kind"]): string {
  switch (kind) {
    case "create":
      return "创建";
    case "delete":
      return "删除";
    case "rename":
      return "重命名";
    case "move":
      return "移动";
    case "content":
      return "内容";
  }
}

function TimelineEmptyState({ active }: { active: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 px-3 py-8 text-center text-xs text-ctp-subtext0">
      <span aria-hidden="true" className="icon-[codicon--history] text-2xl text-ctp-overlay0" />
      <p>{active ? "当前文件还没有时间线记录。" : "打开一个章节或资源文件以查看时间线。"}</p>
    </div>
  );
}

export function TimelineSidebarSection() {
  const timeline = useWorktreeTimeline();
  const revision = useWorktreeScmRevision();
  const { activeEditorTabAtom } = useMolecule(workbenchEditorMolecule);
  const activeTab = useAtomValue(activeEditorTabAtom);
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ entryId: string; content: string | null } | null>(null);

  const target = useMemo<TimelineTarget | null>(() => {
    if (activeTab === undefined) {
      return null;
    }
    if (activeTab.kind === "manuscript") {
      return {
        domain: "manuscript",
        entityId: activeTab.chapterId,
      };
    }
    return {
      domain: "resource",
      entityId: activeTab.resourceId,
    };
  }, [activeTab]);

  useEffect(() => {
    let canceled = false;
    setPreview(null);
    if (target === null) {
      setEntries(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    void Promise.resolve(timeline.listFileTimeline(target, 80))
      .then((result) => {
        if (!canceled) {
          setEntries(result);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (!canceled) {
          notificationApi.error(error instanceof Error ? error.message : "无法加载时间线", {
            source: "时间线",
          });
          setEntries([]);
          setLoading(false);
        }
      });

    return () => {
      canceled = true;
    };
  }, [revision, target, timeline]);

  const previewEntry = useCallback(
    (entry: TimelineEntry) => {
      void Promise.resolve(timeline.readTimelineEntryContent(entry.id))
        .then((result) => {
          setPreview({
            entryId: entry.id,
            content: result.content,
          });
        })
        .catch((error) => {
          notificationApi.error(error instanceof Error ? error.message : "无法读取时间线内容", {
            source: "时间线",
          });
        });
    },
    [timeline],
  );

  const restoreEntry = useCallback(
    (entry: TimelineEntry) => {
      void Promise.resolve(timeline.restoreTimelineEntryContent(entry.id))
        .then(() => {
          notificationApi.info("已恢复时间线内容", { source: "时间线" });
        })
        .catch((error) => {
          notificationApi.error(error instanceof Error ? error.message : "无法恢复时间线内容", {
            source: "时间线",
          });
        });
    },
    [timeline],
  );

  return (
    <>
      {target === null ? (
        <TimelineEmptyState active={false} />
      ) : loading && entries === null ? (
        <div className="flex flex-col items-center gap-2 px-3 py-8 text-center text-xs text-ctp-subtext0">
          <span aria-hidden="true" className="icon-[codicon--loading] animate-spin text-2xl" />
          <p>正在加载时间线…</p>
        </div>
      ) : entries === null || entries.length === 0 ? (
        <TimelineEmptyState active />
      ) : (
        <div className="flex min-w-0 flex-col text-xs">
          {entries.map((entry) => (
            <div key={entry.id} className={timelineRowClass}>
              <div className="flex min-w-0 items-start gap-2">
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
                    {formatTimelineTime(entry.timestamp)}
                    {entry.shortHash ? (
                      <>
                        <span className="mx-1 text-ctp-surface2">·</span>
                        <span className="font-mono">{entry.shortHash}</span>
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 pl-6">
                <button
                  className={timelineButtonClass}
                  disabled={!entry.hasContent}
                  type="button"
                  onClick={() => previewEntry(entry)}
                >
                  <span aria-hidden="true" className="icon-[codicon--open-preview]" />
                  预览
                </button>
                <button
                  className={timelineButtonClass}
                  disabled={!entry.hasContent}
                  type="button"
                  onClick={() => restoreEntry(entry)}
                >
                  <span aria-hidden="true" className="icon-[codicon--replace]" />
                  恢复
                </button>
              </div>
              {preview?.entryId === entry.id ? (
                <div className="pl-6">
                  <pre className={previewClass}>{preview.content ?? "此记录没有可预览内容。"}</pre>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
