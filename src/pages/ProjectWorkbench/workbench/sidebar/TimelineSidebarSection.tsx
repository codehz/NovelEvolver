import { useMolecule } from "bunshi/react";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "#app/lib/cn";
import { notificationApi } from "#app/lib/notifications";
import type { TimelineEntry, TimelineTarget } from "#shared/rpc/worktree-timeline-rpc";

import { useManuscript, useResourceLibrary, useWorktreeTimeline } from "../branch/branch-scopes";
import { useWorktreeScmRevision } from "../branch/use-worktree-scm-revision";
import { useWorkbenchEditorActions } from "../editor/use-workbench-editor-actions";
import { workbenchEditorMolecule } from "../state/molecules";

const timelineRowClass = cn(
  "group flex w-full min-w-0 items-start gap-2 border-b border-titlebar-border p-2 text-left",
  "hover:bg-ctp-surface0/40 focus-visible:bg-ctp-surface0/40 focus-visible:outline-none",
  "disabled:cursor-default hover:disabled:bg-transparent",
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
  if (entry.source === "journal") {
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
    case "reorder":
      return "排序";
    case "content":
      return "内容";
    case "restore":
      return "恢复";
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
  const manuscript = useManuscript();
  const resources = useResourceLibrary();
  const revision = useWorktreeScmRevision();
  const { activeEditorTabAtom } = useMolecule(workbenchEditorMolecule);
  const activeTab = useAtomValue(activeEditorTabAtom);
  const { openTimelinePreviewTab } = useWorkbenchEditorActions();
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

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
    if (activeTab.kind === "timeline-preview") {
      return activeTab.target;
    }
    return {
      domain: "resource",
      entityId: activeTab.resourceId,
    };
  }, [activeTab]);

  useEffect(() => {
    let canceled = false;
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

  const openPreviewEntry = useCallback(
    (entry: TimelineEntry) => {
      if (target === null) {
        return;
      }

      const currentContent =
        target.domain === "manuscript"
          ? Promise.resolve(manuscript.readChapter(target.entityId))
          : Promise.resolve(resources.readFile(target.entityId));

      void Promise.all([
        Promise.resolve(timeline.readTimelineEntryContent(entry.id)),
        currentContent,
      ])
        .then(([historyContent, current]) => {
          if (historyContent.content === null) {
            notificationApi.error("此记录没有可预览内容。", { source: "时间线" });
            return;
          }

          openTimelinePreviewTab({
            id: `timeline-preview:${entry.id}`,
            kind: "timeline-preview",
            label: `预览：${entry.label}`,
            target,
            entryId: entry.id,
            entryMessage: entry.message,
            entryTimestamp: entry.timestamp,
            entryShortHash: entry.shortHash,
            displayPath: entry.displayPath,
            originalContent: historyContent.content,
            currentContent: current,
          });
        })
        .catch((error) => {
          notificationApi.error(error instanceof Error ? error.message : "无法打开时间线预览", {
            source: "时间线",
          });
        });
    },
    [manuscript, openTimelinePreviewTab, resources, target, timeline],
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
            <button
              key={entry.id}
              className={timelineRowClass}
              disabled={!entry.hasContent}
              type="button"
              onClick={() => openPreviewEntry(entry)}
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
                  {formatTimelineTime(entry.timestamp)}
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
