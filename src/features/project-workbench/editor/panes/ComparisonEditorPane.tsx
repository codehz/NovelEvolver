import { useMolecule } from "bunshi/react";
import { useSetAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";

import { notificationApi } from "#app/shared/lib/notifications";
import { isNoChangeTextDiffError } from "#workbench/lib/comparison-errors";
import {
  useHistory,
  useManuscript,
  useResourceLibrary,
  useWorktreeChanges,
} from "#workbench/session/workspace-handles";

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
          throw new Error("提交内差异为只读预览，无法恢复到工作区。");
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

  const comparisonAriaLabel =
    tab.target.kind === "history-entry"
      ? "历史差异预览"
      : tab.target.kind === "commit-change"
        ? "提交差异预览"
        : "更改差异预览";

  return (
    <TextComparisonEditor
      active={active}
      currentContent={tab.currentContent}
      originalContent={tab.originalContent}
      editable={tab.canEditCurrent}
      onChange={handleChange}
      onRestoreHunk={tab.canEditCurrent ? handleRestoreHistoryHunk : undefined}
      aria-label={comparisonAriaLabel}
    />
  );
}
