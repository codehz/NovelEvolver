import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useRef, useState } from "react";
import type { ComponentType } from "react";

import { PlainTextEditor, type PlainTextEditorHandle } from "#app/components/PlainTextEditor";
import { notificationApi } from "#app/lib/notifications";
import { useOneShotRequestConsumer } from "#app/lib/one-shot-request";

import { useWorktreeChanges, useWorktreeTimeline } from "../branch/branch-scopes";
import { editorTabMolecule, workbenchEditorMolecule } from "../state/molecules";
import type { ContentWorkbenchEditorTab, WorkbenchEditorTab } from "../state/types";
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
  const changes = useWorktreeChanges();
  const timeline = useWorktreeTimeline();
  const { editorStateAtom } = useMolecule(workbenchEditorMolecule);
  const setEditorState = useSetAtom(editorStateAtom);
  const handleRestoreTimelineHunk = useCallback(
    async ({ beforeContent, afterContent }: TextComparisonRestoreHunkChange) => {
      try {
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
              candidate.id === tab.id
                ? {
                    ...tab,
                    ...(next === null
                      ? {
                          originalContent: afterContent,
                          currentContent: afterContent,
                        }
                      : {
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
            candidate.id === tab.id ? { ...tab, currentContent: afterContent } : candidate,
          ),
        }));
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "局部恢复失败", {
          source: tab.target.kind === "timeline-entry" ? "时间线" : "SCM",
        });
        throw error;
      }
    },
    [changes, noScmTextDiffErrorMessage, setEditorState, tab, timeline],
  );

  return (
    <TextComparisonEditor
      active={active}
      currentContent={tab.currentContent}
      originalContent={tab.originalContent}
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
