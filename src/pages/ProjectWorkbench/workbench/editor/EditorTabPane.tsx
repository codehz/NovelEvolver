import { ScopeProvider, useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom } from "jotai";
import type { Ref } from "react";
import { useCallback } from "react";

import { PlainTextEditor, type PlainTextEditorHandle } from "#app/components/PlainTextEditor";

import { useManuscript, useResourceLibrary } from "../branch/branch-scopes";
import { useResourceAutosave, useTextAutosave } from "../resource-library/use-resource-autosave";
import { editorTabMolecule, editorTabScope } from "../state/molecules";

type EditorTabPaneProps = {
  tabId: string;
  active: boolean;
  defaultValue: string;
  editorRef?: Ref<PlainTextEditorHandle>;
  resourceId?: string;
  chapterId?: string;
};

function EditorTabPlainTextEditor({
  ref,
  active,
  defaultValue,
  resourceId,
  chapterId,
}: {
  ref?: Ref<PlainTextEditorHandle>;
  active: boolean;
  defaultValue: string;
  resourceId?: string;
  chapterId?: string;
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

  const scheduleSave = useResourceAutosave(resourceId, writeFile);
  const scheduleChapterSave = useTextAutosave(chapterId, writeChapter, "正文");

  return (
    <PlainTextEditor
      ref={ref}
      active={active}
      defaultValue={defaultValue}
      selectionSnapshot={selectionSnapshot}
      onSelectionSnapshotChange={setSelectionSnapshot}
      onCaretChange={setCaretPosition}
      onChange={
        resourceId != null ? scheduleSave : chapterId != null ? scheduleChapterSave : undefined
      }
    />
  );
}

export function EditorTabPane({
  tabId,
  active,
  defaultValue,
  editorRef,
  resourceId,
  chapterId,
}: EditorTabPaneProps) {
  return (
    <ScopeProvider scope={editorTabScope} value={tabId}>
      <div
        className={active ? "flex min-h-0 min-w-0 flex-1 flex-col" : "hidden"}
        aria-hidden={!active}
      >
        <EditorTabPlainTextEditor
          active={active}
          defaultValue={defaultValue}
          ref={editorRef}
          resourceId={resourceId}
          chapterId={chapterId}
        />
      </div>
    </ScopeProvider>
  );
}
