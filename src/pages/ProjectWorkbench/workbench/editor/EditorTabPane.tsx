import { ScopeProvider, useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom } from "jotai";
import type { Ref } from "react";
import { useCallback } from "react";

import { PlainTextEditor, type PlainTextEditorHandle } from "#app/components/PlainTextEditor";

import { useManuscript, useResourceLibrary } from "../branch/branch-scopes";
import {
  useResourceAutosave,
  useTextAutosave,
} from "../explorer/resource-library/use-resource-autosave";
import { editorTabMolecule, editorTabScope } from "../state/molecules";
import type { ContentWorkbenchEditorTab, WorkbenchEditorTab } from "../state/types";
import { TimelineMergePreviewEditor } from "./TimelineMergePreviewEditor";
import { useWorkbenchEditorActions } from "./use-workbench-editor-actions";

type EditorTabPaneProps = {
  tab: WorkbenchEditorTab;
  active: boolean;
  transient: boolean;
  editorRef?: Ref<PlainTextEditorHandle>;
};

function EditorTabPlainTextEditor({
  ref,
  tab,
  active,
  transient,
}: {
  ref?: Ref<PlainTextEditorHandle>;
  tab: ContentWorkbenchEditorTab;
  active: boolean;
  transient: boolean;
}) {
  const { caretPositionAtom, selectionSnapshotAtom } = useMolecule(editorTabMolecule);
  const selectionSnapshot = useAtomValue(selectionSnapshotAtom);
  const setCaretPosition = useSetAtom(caretPositionAtom);
  const setSelectionSnapshot = useSetAtom(selectionSnapshotAtom);
  const resources = useResourceLibrary();
  const manuscript = useManuscript();
  const { pinTab } = useWorkbenchEditorActions();

  const writeFile = useCallback(
    async (id: string, content: string) => {
      await resources.writeFile(id, content);
    },
    [resources],
  );

  const writeChapter = useCallback(
    async (id: string, content: string) => {
      await manuscript.writeChapter(id, content);
    },
    [manuscript],
  );

  const resourceId = tab.kind === "resource" ? tab.resourceId : undefined;
  const chapterId = tab.kind === "manuscript" ? tab.chapterId : undefined;
  const scheduleSave = useResourceAutosave(resourceId, writeFile);
  const scheduleChapterSave = useTextAutosave(chapterId, writeChapter, "正文");
  const handleChange = useCallback(
    (next: string) => {
      if (transient) {
        pinTab(tab.id);
      }
      if (resourceId != null) {
        scheduleSave(next);
        return;
      }
      if (chapterId != null) {
        scheduleChapterSave(next);
      }
    },
    [chapterId, pinTab, resourceId, scheduleChapterSave, scheduleSave, tab.id, transient],
  );

  return (
    <PlainTextEditor
      ref={ref}
      active={active}
      defaultValue={tab.initialContent}
      selectionSnapshot={selectionSnapshot}
      onSelectionSnapshotChange={setSelectionSnapshot}
      onCaretChange={setCaretPosition}
      onChange={handleChange}
    />
  );
}

export function EditorTabPane({ tab, active, transient, editorRef }: EditorTabPaneProps) {
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
          />
        ) : (
          <EditorTabPlainTextEditor
            ref={editorRef}
            tab={tab}
            active={active}
            transient={transient}
          />
        )}
      </div>
    </ScopeProvider>
  );
}
