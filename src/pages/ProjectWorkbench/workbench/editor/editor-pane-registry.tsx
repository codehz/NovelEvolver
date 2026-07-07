import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";

import { PlainTextEditor, type PlainTextEditorHandle } from "#app/components/PlainTextEditor";
import { notificationApi } from "#app/lib/notifications";
import { useOneShotRequestConsumer } from "#app/lib/one-shot-request";

import {
  useManuscript,
  useResourceLibrary,
  useWorktreeChanges,
  useWorktreeTimeline,
} from "../branch/branch-scopes";
import { editorTabMolecule, workbenchEditorMolecule } from "../state/molecules";
import type {
  ComparisonWorkbenchEditorTab,
  ContentWorkbenchEditorTab,
  WorkbenchEditorTab,
} from "../state/types";
import { getWorkbenchEditorTabTargetKey } from "./editor-contributions";
import { TextComparisonEditor, type TextComparisonRestoreHunkChange } from "./TextComparisonEditor";
import type { WorkbenchEditorDocumentRuntime } from "./use-workbench-editor-document-runtime";

export type WorkbenchEditorPaneProps = {
  tab: WorkbenchEditorTab;
  active: boolean;
  transient: boolean;
  documentRuntime: WorkbenchEditorDocumentRuntime;
};

type WorkbenchEditorPaneContribution<TTab extends WorkbenchEditorTab = WorkbenchEditorTab> = {
  tabKind: TTab["kind"];
  Pane: ComponentType<WorkbenchEditorPaneProps>;
};

const COMPARISON_AUTOSAVE_DEBOUNCE_MS = 600;

function isMissingComparisonTargetError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.startsWith("Manuscript node does not exist:") ||
    error.message.startsWith("Manuscript chapter is missing:") ||
    error.message.startsWith("Resource node does not exist:") ||
    error.message.startsWith("Resource file is missing:")
  );
}

function readComparisonTargetCurrentContent(
  target: ComparisonWorkbenchEditorTab["target"]["sourceTarget"],
  manuscript: ReturnType<typeof useManuscript>,
  resources: ReturnType<typeof useResourceLibrary>,
): Promise<string | null> {
  const read =
    target.domain === "manuscript"
      ? Promise.resolve(manuscript.readChapter(target.entityId))
      : Promise.resolve(resources.readFile(target.entityId));
  return read.catch((error: unknown) => {
    if (isMissingComparisonTargetError(error)) {
      return null;
    }
    throw error;
  });
}

function writeComparisonTargetCurrentContent(
  target: ComparisonWorkbenchEditorTab["target"]["sourceTarget"],
  content: string,
  manuscript: ReturnType<typeof useManuscript>,
  resources: ReturnType<typeof useResourceLibrary>,
): Promise<void> {
  if (target.domain === "manuscript") {
    return Promise.resolve(manuscript.writeChapter(target.entityId, content));
  }
  return Promise.resolve(resources.writeFile(target.entityId, content));
}

function TextDocumentEditorPane({
  tab,
  active,
  transient,
  documentRuntime,
}: WorkbenchEditorPaneProps & { tab: ContentWorkbenchEditorTab }) {
  const { caretPositionAtom, selectionSnapshotAtom } = useMolecule(editorTabMolecule);
  const { onNavigationRequest, retryPendingNavigation } = useMolecule(workbenchEditorMolecule);
  const selectionSnapshot = useAtomValue(selectionSnapshotAtom);
  const setCaretPosition = useSetAtom(caretPositionAtom);
  const setSelectionSnapshot = useSetAtom(selectionSnapshotAtom);
  const document = documentRuntime.getDocument(tab);
  const editorRef = useRef<PlainTextEditorHandle | null>(null);
  const [hasEditor, setHasEditor] = useState(false);
  const targetKey = getWorkbenchEditorTabTargetKey(tab);
  const registerEditor = useCallback(
    (handle: Parameters<WorkbenchEditorDocumentRuntime["registerEditor"]>[1]) => {
      editorRef.current = handle;
      setHasEditor(handle !== null);
      documentRuntime.registerEditor(tab, handle);
    },
    [documentRuntime, tab],
  );
  const handleChange = useCallback(
    (next: string) => {
      documentRuntime.handleContentChange(tab, next, transient);
    },
    [documentRuntime, tab, transient],
  );

  useOneShotRequestConsumer({
    subscribe: onNavigationRequest,
    replay: retryPendingNavigation,
    retryDeps: [active, hasEditor, targetKey],
    consume: (request) => {
      if (request.targetKey !== targetKey) {
        return "skip";
      }
      if (request.kind !== "text-range") {
        return "skip";
      }
      if (!active || editorRef.current === null) {
        return "retry";
      }
      const applied = editorRef.current.applySelection(request.selection, {
        focus: true,
        scrollIntoView: true,
      });
      return applied ? "done" : "retry";
    },
  });

  return (
    <PlainTextEditor
      ref={registerEditor}
      active={active}
      defaultValue={document?.baselineContent ?? ""}
      selectionSnapshot={selectionSnapshot}
      onSelectionSnapshotChange={setSelectionSnapshot}
      onCaretChange={setCaretPosition}
      onChange={handleChange}
    />
  );
}

function ComparisonEditorPane({
  tab,
  active,
}: WorkbenchEditorPaneProps & {
  tab: Extract<WorkbenchEditorTab, { kind: "comparison" }>;
}) {
  const noScmTextDiffErrorMessage = "此节点当前没有可预览的文本差异。";
  const manuscript = useManuscript();
  const resources = useResourceLibrary();
  const changes = useWorktreeChanges();
  const timeline = useWorktreeTimeline();
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

        void writeComparisonTargetCurrentContent(
          currentTab.target.sourceTarget,
          currentTab.currentContent,
          manuscriptRef.current,
          resourcesRef.current,
        ).catch((error) => {
          notificationApi.error(error instanceof Error ? error.message : "自动保存失败", {
            source: currentTab.target.kind === "timeline-entry" ? "时间线" : "SCM",
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
    [clearPendingAutosave, updateComparisonTab],
  );

  const handleRestoreTimelineHunk = useCallback(
    async ({ beforeContent, afterContent }: TextComparisonRestoreHunkChange) => {
      try {
        clearPendingAutosave();
        if (tab.target.kind === "timeline-entry") {
          await Promise.resolve(
            timeline.restoreTimelineEntryContentHunk(
              tab.target.entryId,
              beforeContent,
              afterContent,
            ),
          );
        } else {
          await Promise.resolve(
            changes.restoreChangeTextHunk(tab.target.sourceTarget, beforeContent, afterContent),
          );
          const next = await Promise.resolve(
            changes.readChangeTextComparisonByTarget(tab.target.sourceTarget),
          ).catch((error: unknown) => {
            if (error instanceof Error && error.message === noScmTextDiffErrorMessage) {
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
                          originalContent: afterContent,
                          currentContent: afterContent,
                        }
                      : {
                          canEditCurrent: next.kind !== "delete",
                          target: {
                            kind: "scm-change" as const,
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
          source: tab.target.kind === "timeline-entry" ? "时间线" : "SCM",
        });
        throw error;
      }
    },
    [changes, clearPendingAutosave, noScmTextDiffErrorMessage, setEditorState, tab, timeline],
  );

  return (
    <TextComparisonEditor
      active={active}
      currentContent={tab.currentContent}
      originalContent={tab.originalContent}
      editable={tab.canEditCurrent}
      onChange={handleChange}
      onRestoreHunk={handleRestoreTimelineHunk}
      aria-label={tab.target.kind === "timeline-entry" ? "时间线差异预览" : "SCM 差异预览"}
    />
  );
}

const workbenchEditorPaneContributions: readonly WorkbenchEditorPaneContribution[] = [
  {
    tabKind: "resource",
    Pane: TextDocumentEditorPane as ComponentType<WorkbenchEditorPaneProps>,
  },
  {
    tabKind: "manuscript",
    Pane: TextDocumentEditorPane as ComponentType<WorkbenchEditorPaneProps>,
  },
  {
    tabKind: "comparison",
    Pane: ComparisonEditorPane as ComponentType<WorkbenchEditorPaneProps>,
  },
] as const;

export function getWorkbenchEditorPane(
  tab: WorkbenchEditorTab,
): ComponentType<WorkbenchEditorPaneProps> {
  const contribution = workbenchEditorPaneContributions.find(
    (candidate) => candidate.tabKind === tab.kind,
  );
  if (contribution === undefined) {
    throw new Error(`Unsupported workbench editor tab kind: ${tab.kind}`);
  }
  return contribution.Pane as ComponentType<WorkbenchEditorPaneProps>;
}
