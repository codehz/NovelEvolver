import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import type { ComponentType } from "react";

import { PlainTextEditor } from "#app/components/PlainTextEditor";
import { notificationApi } from "#app/lib/notifications";

import { useWorktreeTimeline } from "../branch/branch-scopes";
import { editorTabMolecule, workbenchEditorMolecule } from "../state/molecules";
import type { ContentWorkbenchEditorTab, WorkbenchEditorTab } from "../state/types";
import {
  TimelineMergePreviewEditor,
  type TimelineMergePreviewRestoreHunkChange,
} from "./TimelineMergePreviewEditor";
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
  const selectionSnapshot = useAtomValue(selectionSnapshotAtom);
  const setCaretPosition = useSetAtom(caretPositionAtom);
  const setSelectionSnapshot = useSetAtom(selectionSnapshotAtom);
  const document = documentRuntime.getDocument(tab);
  const registerEditor = useCallback(
    (handle: Parameters<WorkbenchEditorDocumentRuntime["registerEditor"]>[1]) => {
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

function TimelineComparisonEditorPane({
  tab,
  active,
}: WorkbenchEditorPaneProps & {
  tab: Extract<WorkbenchEditorTab, { kind: "timeline-comparison" }>;
}) {
  const timeline = useWorktreeTimeline();
  const { editorStateAtom } = useMolecule(workbenchEditorMolecule);
  const setEditorState = useSetAtom(editorStateAtom);
  const handleRestoreTimelineHunk = useCallback(
    async ({ beforeContent, afterContent }: TimelineMergePreviewRestoreHunkChange) => {
      try {
        await Promise.resolve(
          timeline.restoreTimelineEntryContentHunk(tab.entryId, beforeContent, afterContent),
        );
        setEditorState((state) => ({
          ...state,
          tabs: state.tabs.map((candidate) =>
            candidate.id === tab.id ? { ...tab, currentContent: afterContent } : candidate,
          ),
        }));
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "局部回滚失败", {
          source: "时间线",
        });
        throw error;
      }
    },
    [setEditorState, tab, timeline],
  );

  return (
    <TimelineMergePreviewEditor
      active={active}
      currentContent={tab.currentContent}
      originalContent={tab.originalContent}
      onRestoreHunk={handleRestoreTimelineHunk}
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
    tabKind: "timeline-comparison",
    Pane: TimelineComparisonEditorPane as ComponentType<WorkbenchEditorPaneProps>,
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
