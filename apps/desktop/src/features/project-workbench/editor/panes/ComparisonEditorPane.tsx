import { useMolecule } from "bunshi/react";
import { useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";

import { isNoChangeTextDiffError } from "#app/features/project-workbench/lib/comparison-errors";
import {
  useHistory,
  useManuscript,
  useResourceLibrary,
  useWorktreeChanges,
} from "#app/features/project-workbench/session/workspace-handles";
import { confirmDialogApi } from "#app/shared/lib/confirm-dialog";
import { notificationApi } from "#app/shared/lib/notifications";
import { cn } from "#app/shared/lib/ui/cn";
import { Button } from "#app/shared/ui";

import { workbenchEditorMolecule } from "../state/molecules";
import type { ComparisonWorkbenchEditorTab, WorkbenchEditorTab } from "../state/types";
import {
  TextComparisonEditor,
  type TextComparisonRestoreHunkChange,
} from "../TextComparisonEditor";
import {
  readComparisonTargetCurrentContent,
  writeComparisonTargetCurrentContent,
} from "./comparison-target-io";
import type { WorkbenchEditorPaneProps } from "./types";

const COMPARISON_AUTOSAVE_DEBOUNCE_MS = 600;

const comparisonToolbarClass = cn(
  "flex shrink-0 items-center gap-2 border-b border-titlebar-border bg-app-background px-3 py-1.5",
);
const comparisonToolbarHintClass = cn("min-w-0 flex-1 truncate text-2xs text-ctp-overlay0");

type ComparisonEditorPaneProps = WorkbenchEditorPaneProps & {
  tab: Extract<WorkbenchEditorTab, { kind: "comparison" }>;
};

export function ComparisonEditorPane({ tab, active }: ComparisonEditorPaneProps) {
  const manuscript = useManuscript();
  const resources = useResourceLibrary();
  const changes = useWorktreeChanges();
  const history = useHistory();
  const { editorStateAtom } = useMolecule(workbenchEditorMolecule);
  const setEditorState = useSetAtom(editorStateAtom);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manuscriptRef = useRef(manuscript);
  const resourcesRef = useRef(resources);
  const latestTabRef = useRef(tab);
  const [restoring, setRestoring] = useState(false);

  manuscriptRef.current = manuscript;
  resourcesRef.current = resources;
  latestTabRef.current = tab;

  const clearPendingAutosave = useCallback(() => {
    if (autosaveTimerRef.current !== null) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!tab.canEditCurrent) {
      clearPendingAutosave();
    }
  }, [clearPendingAutosave, tab.canEditCurrent]);

  useEffect(
    () => () => {
      clearPendingAutosave();
    },
    [clearPendingAutosave],
  );

  const updateComparisonTab = useCallback(
    (update: (candidate: ComparisonWorkbenchEditorTab) => ComparisonWorkbenchEditorTab) => {
      setEditorState((state) => ({
        ...state,
        tabs: state.tabs.map((candidate) =>
          candidate.id === tab.id && candidate.kind === "comparison"
            ? update(candidate)
            : candidate,
        ),
      }));
    },
    [setEditorState, tab.id],
  );

  const syncChangeComparisonTab = useCallback(
    async (
      sourceTarget: ComparisonWorkbenchEditorTab["target"]["sourceTarget"],
      fallback: string,
    ) => {
      const next = await Promise.resolve(
        changes.readChangeTextComparisonByTarget(sourceTarget),
      ).catch((error: unknown) => {
        if (isNoChangeTextDiffError(error)) {
          return null;
        }
        throw error;
      });
      setEditorState((state) => ({
        ...state,
        tabs: state.tabs.map((candidate) =>
          candidate.id === tab.id && candidate.kind === "comparison"
            ? {
                ...candidate,
                ...(next === null
                  ? {
                      canEditCurrent: true,
                      originalContent: fallback,
                      currentContent: fallback,
                    }
                  : {
                      canEditCurrent: true,
                      target: {
                        kind: "change" as const,
                        sourceTarget: next.target,
                        changeId: next.changeId,
                        changeKind: next.kind,
                      },
                      label: `更改：${next.label}`,
                      displayPath: next.displayPath,
                      originalContent: next.originalContent,
                      currentContent: next.currentContent,
                    }),
              }
            : candidate,
        ),
      }));
    },
    [changes, setEditorState, tab.id],
  );

  const handleChange = useCallback(
    (next: string) => {
      updateComparisonTab((candidate) => ({
        ...candidate,
        currentContent: next,
      }));
      if (!latestTabRef.current.canEditCurrent) {
        clearPendingAutosave();
        return;
      }

      clearPendingAutosave();
      autosaveTimerRef.current = setTimeout(() => {
        autosaveTimerRef.current = null;
        const currentTab = latestTabRef.current;
        if (!currentTab.canEditCurrent) {
          return;
        }

        const save =
          currentTab.target.kind === "change" && currentTab.target.changeKind === "delete"
            ? Promise.resolve(
                changes.restoreChangeTextHunk(
                  currentTab.target.sourceTarget,
                  "",
                  currentTab.currentContent,
                ),
              ).then(() =>
                syncChangeComparisonTab(currentTab.target.sourceTarget, currentTab.currentContent),
              )
            : writeComparisonTargetCurrentContent(
                currentTab.target.sourceTarget,
                currentTab.currentContent,
                manuscriptRef.current,
                resourcesRef.current,
              );

        void Promise.resolve(save).catch((error) => {
          if (
            currentTab.target.kind === "change" &&
            currentTab.target.changeKind === "delete" &&
            isNoChangeTextDiffError(error)
          ) {
            void syncChangeComparisonTab(currentTab.target.sourceTarget, currentTab.currentContent);
            return;
          }

          notificationApi.error(error instanceof Error ? error.message : "自动保存失败", {
            source:
              currentTab.target.kind === "history-entry" ||
              currentTab.target.kind === "commit-change"
                ? "历史"
                : "更改",
          });

          void readComparisonTargetCurrentContent(
            currentTab.target.sourceTarget,
            manuscriptRef.current,
            resourcesRef.current,
          )
            .then((content) => {
              if (content !== null) {
                return;
              }
              clearPendingAutosave();
              updateComparisonTab((candidate) => ({
                ...candidate,
                canEditCurrent: false,
                currentContent: "",
              }));
            })
            .catch(() => {});
        });
      }, COMPARISON_AUTOSAVE_DEBOUNCE_MS);
    },
    [changes, clearPendingAutosave, syncChangeComparisonTab, updateComparisonTab],
  );

  const handleRestoreHistoryHunk = useCallback(
    async ({ beforeContent, afterContent }: TextComparisonRestoreHunkChange) => {
      try {
        clearPendingAutosave();
        if (tab.target.kind === "commit-change") {
          throw new Error("提交内差异请使用工具栏整文件恢复到工作区。");
        }
        if (tab.target.kind === "history-entry") {
          await Promise.resolve(
            history.restoreHistoryEntryContentHunk(tab.target.entryId, beforeContent, afterContent),
          );
        } else {
          await Promise.resolve(
            changes.restoreChangeTextHunk(tab.target.sourceTarget, beforeContent, afterContent),
          );
          await syncChangeComparisonTab(tab.target.sourceTarget, afterContent);
          return;
        }
        setEditorState((state) => ({
          ...state,
          tabs: state.tabs.map((candidate) =>
            candidate.id === tab.id && candidate.kind === "comparison"
              ? {
                  ...candidate,
                  currentContent: afterContent,
                }
              : candidate,
          ),
        }));
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "局部恢复失败", {
          source:
            tab.target.kind === "history-entry" || tab.target.kind === "commit-change"
              ? "历史"
              : "更改",
        });
        throw error;
      }
    },
    [changes, clearPendingAutosave, history, setEditorState, syncChangeComparisonTab, tab],
  );

  const refreshLiveCurrentContent = useCallback(async () => {
    const content = await readComparisonTargetCurrentContent(
      tab.target.sourceTarget,
      manuscriptRef.current,
      resourcesRef.current,
    );
    if (content === null) {
      updateComparisonTab((candidate) => ({
        ...candidate,
        canEditCurrent: false,
        currentContent: "",
      }));
      return;
    }
    updateComparisonTab((candidate) => ({
      ...candidate,
      canEditCurrent: true,
      currentContent: content,
    }));
  }, [tab.target.sourceTarget, updateComparisonTab]);

  const handleAdoptFullOriginal = useCallback(async () => {
    if (restoring) {
      return;
    }
    if (tab.originalContent === tab.currentContent) {
      return;
    }

    const confirmed = await confirmDialogApi.confirm({
      title: "采用全部对照版本",
      description: "将当前侧全文替换为对照侧（左侧）内容，并写回工作区草稿。",
      confirmLabel: "采用全部",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    setRestoring(true);
    clearPendingAutosave();
    try {
      if (tab.target.kind === "history-entry") {
        await Promise.resolve(history.restoreEntityFromHistoryEntry(tab.target.entryId));
        await refreshLiveCurrentContent();
        notificationApi.info("已采用历史版本全文", { source: "历史" });
        return;
      }
      if (tab.target.kind === "change") {
        await Promise.resolve(
          changes.restoreChangeTextHunk(
            tab.target.sourceTarget,
            tab.currentContent,
            tab.originalContent,
          ),
        );
        await syncChangeComparisonTab(tab.target.sourceTarget, tab.originalContent);
        notificationApi.info("已采用基线全文", { source: "更改" });
        return;
      }
      throw new Error("当前对比不支持全文采用。");
    } catch (error) {
      notificationApi.error(error instanceof Error ? error.message : "全文采用失败", {
        source: tab.target.kind === "change" ? "更改" : "历史",
      });
    } finally {
      setRestoring(false);
    }
  }, [
    changes,
    clearPendingAutosave,
    history,
    refreshLiveCurrentContent,
    restoring,
    syncChangeComparisonTab,
    tab,
  ]);

  const handleRestoreCommitVersion = useCallback(async () => {
    if (restoring || tab.target.kind !== "commit-change") {
      return;
    }
    const short = tab.target.shortHash ?? tab.target.commitHash.slice(0, 7);
    const confirmed = await confirmDialogApi.confirm({
      title: "采用提交版本到工作区",
      description: `将当前文件恢复为提交 ${short} 中的内容，覆盖工作区草稿对应文件。分支 tip 不会移动。`,
      confirmLabel: "采用提交版本",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    setRestoring(true);
    clearPendingAutosave();
    try {
      await Promise.resolve(
        history.restoreEntityFromCommit(tab.target.commitHash, tab.target.sourceTarget),
      );
      notificationApi.info(`已将文件恢复至提交 ${short}`, { source: "历史" });
    } catch (error) {
      notificationApi.error(error instanceof Error ? error.message : "恢复提交版本失败", {
        source: "历史",
      });
    } finally {
      setRestoring(false);
    }
  }, [clearPendingAutosave, history, restoring, tab]);

  const handleRestoreParentVersion = useCallback(async () => {
    if (restoring || tab.target.kind !== "commit-change") {
      return;
    }
    const commitTarget = tab.target;
    const short = commitTarget.shortHash ?? commitTarget.commitHash.slice(0, 7);
    const confirmed = await confirmDialogApi.confirm({
      title: "采用父版本到工作区",
      description: `将当前文件恢复为提交 ${short} 的父版本内容（差异左侧）。若该提交中新建了此文件，父版本为空。分支 tip 不会移动。`,
      confirmLabel: "采用父版本",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    setRestoring(true);
    clearPendingAutosave();
    try {
      const snapshot = await Promise.resolve(history.listCommitChanges(commitTarget.commitHash));
      const writeParentContent = async () => {
        await Promise.resolve(
          history.restoreEntityFromCommit(commitTarget.commitHash, commitTarget.sourceTarget),
        );
        await writeComparisonTargetCurrentContent(
          commitTarget.sourceTarget,
          tab.originalContent,
          manuscriptRef.current,
          resourcesRef.current,
        );
      };

      if (snapshot.parentHash === null) {
        await writeParentContent();
      } else {
        try {
          await Promise.resolve(
            history.restoreEntityFromCommit(snapshot.parentHash, commitTarget.sourceTarget),
          );
        } catch {
          // 父提交中不存在该实体（例如此提交新建）时，回退为写入父侧文本。
          await writeParentContent();
        }
      }
      notificationApi.info("已将文件恢复至父版本", { source: "历史" });
    } catch (error) {
      notificationApi.error(error instanceof Error ? error.message : "恢复父版本失败", {
        source: "历史",
      });
    } finally {
      setRestoring(false);
    }
  }, [clearPendingAutosave, history, restoring, tab]);

  const comparisonAriaLabel =
    tab.target.kind === "history-entry"
      ? "历史差异预览"
      : tab.target.kind === "commit-change"
        ? "提交差异预览"
        : "更改差异预览";

  const canAdoptFullOriginal =
    tab.target.kind !== "commit-change" &&
    tab.canEditCurrent &&
    tab.originalContent !== tab.currentContent;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className={comparisonToolbarClass}>
        <span className={comparisonToolbarHintClass}>
          {tab.target.kind === "commit-change"
            ? "显示父版本与该提交版本的差异；可写回工作区草稿。"
            : tab.target.kind === "history-entry"
              ? "显示历史版本与当前工作区的差异；可局部回滚或全文采用。"
              : "显示基线与当前工作区的差异；可局部回滚或全文采用。"}
        </span>
        {tab.target.kind === "commit-change" ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              disabled={restoring}
              onClick={() => {
                void handleRestoreParentVersion();
              }}
            >
              采用父版本
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={restoring}
              onClick={() => {
                void handleRestoreCommitVersion();
              }}
            >
              采用提交版本
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled={!canAdoptFullOriginal || restoring}
            onClick={() => {
              void handleAdoptFullOriginal();
            }}
          >
            采用全部对照版本
          </Button>
        )}
      </div>
      <TextComparisonEditor
        active={active}
        currentContent={tab.currentContent}
        originalContent={tab.originalContent}
        editable={tab.canEditCurrent}
        onChange={handleChange}
        onRestoreHunk={tab.canEditCurrent ? handleRestoreHistoryHunk : undefined}
        aria-label={comparisonAriaLabel}
      />
    </div>
  );
}
