import { ScopeProvider, useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";

import { PlainTextEditor } from "#app/components/PlainTextEditor";
import { notificationApi } from "#app/lib/notifications";

import { useWorktreeTimeline } from "../branch/branch-scopes";
import { editorTabMolecule, editorTabScope, workbenchEditorMolecule } from "../state/molecules";
import type { ContentWorkbenchEditorTab, WorkbenchEditorTab } from "../state/types";
import {
  TimelineMergePreviewEditor,
  type TimelineMergePreviewRestoreHunkChange,
} from "./TimelineMergePreviewEditor";
import type { WorkbenchEditorDocumentRuntime } from "./use-workbench-editor-document-runtime";

type EditorTabPaneProps = {
  tab: WorkbenchEditorTab;
  active: boolean;
  transient: boolean;
  documentRuntime: WorkbenchEditorDocumentRuntime;
};

function EditorTabPlainTextEditor({
  tab,
  active,
  transient,
  documentRuntime,
}: {
  tab: ContentWorkbenchEditorTab;
  active: boolean;
  transient: boolean;
  documentRuntime: WorkbenchEditorDocumentRuntime;
}) {
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

export function EditorTabPane({ tab, active, transient, documentRuntime }: EditorTabPaneProps) {
  const timeline = useWorktreeTimeline();
  const { editorStateAtom } = useMolecule(workbenchEditorMolecule);
  const setEditorState = useSetAtom(editorStateAtom);
  const handleRestoreTimelineHunk = useCallback(
    async ({ beforeContent, afterContent }: TimelineMergePreviewRestoreHunkChange) => {
      if (tab.kind !== "timeline-comparison") {
        return;
      }

      try {
        await Promise.resolve(
          timeline.restoreTimelineEntryContentHunk(tab.entryId, beforeContent, afterContent),
        );
        setEditorState((state) => ({
          ...state,
          tabs: state.tabs.map((candidate) =>
            candidate.id === tab.id && candidate.kind === "timeline-comparison"
              ? { ...candidate, currentContent: afterContent }
              : candidate,
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
    <ScopeProvider scope={editorTabScope} value={tab.id}>
      <div
        className={active ? "flex min-h-0 min-w-0 flex-1 flex-col" : "hidden"}
        aria-hidden={!active}
      >
        {tab.kind === "timeline-comparison" ? (
          <TimelineMergePreviewEditor
            active={active}
            currentContent={tab.currentContent}
            originalContent={tab.originalContent}
            onRestoreHunk={handleRestoreTimelineHunk}
          />
        ) : (
          <EditorTabPlainTextEditor
            tab={tab}
            active={active}
            transient={transient}
            documentRuntime={documentRuntime}
          />
        )}
      </div>
    </ScopeProvider>
  );
}
