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

type EditorTabPaneProps = {
  tab: WorkbenchEditorTab;
  editorRef?: Ref<PlainTextEditorHandle>;
};

function EditorTabPlainTextEditor({
  ref,
  tab,
}: {
  ref?: Ref<PlainTextEditorHandle>;
  tab: ContentWorkbenchEditorTab;
}) {
  const { caretPositionAtom, selectionSnapshotAtom } = useMolecule(editorTabMolecule);
  const selectionSnapshot = useAtomValue(selectionSnapshotAtom);
  const setCaretPosition = useSetAtom(caretPositionAtom);
  const setSelectionSnapshot = useSetAtom(selectionSnapshotAtom);
  const resources = useResourceLibrary();
  const manuscript = useManuscript();

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

  return (
    <PlainTextEditor
      ref={ref}
      active={tab.active}
      defaultValue={tab.initialContent}
      selectionSnapshot={selectionSnapshot}
      onSelectionSnapshotChange={setSelectionSnapshot}
      onCaretChange={setCaretPosition}
      onChange={
        resourceId != null ? scheduleSave : chapterId != null ? scheduleChapterSave : undefined
      }
    />
  );
}

export function EditorTabPane({ tab, editorRef }: EditorTabPaneProps) {
  return (
    <ScopeProvider scope={editorTabScope} value={tab.id}>
      <div
        className={tab.active ? "flex min-h-0 min-w-0 flex-1 flex-col" : "hidden"}
        aria-hidden={!tab.active}
      >
        {tab.kind === "timeline-preview" ? (
          <TimelineMergePreviewEditor
            active={tab.active}
            currentContent={tab.currentContent}
            originalContent={tab.originalContent}
          />
        ) : (
          <EditorTabPlainTextEditor ref={editorRef} tab={tab} />
        )}
      </div>
    </ScopeProvider>
  );
}
