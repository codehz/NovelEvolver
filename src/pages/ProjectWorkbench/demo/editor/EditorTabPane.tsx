import { ScopeProvider, useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";

import { PlainTextEditor } from "#app/components/PlainTextEditor";

import { useResourceAutosave, useTextAutosave } from "../../resource-library/use-resource-autosave";
import { useManuscript, useResourceLibrary } from "../branch/branch-scopes";
import { editorTabMolecule, editorTabScope } from "../state/molecules";

type EditorTabPaneProps = {
  tabId: string;
  active: boolean;
  defaultValue: string;
  resourcePath?: string;
  chapterId?: string;
};

function EditorTabPlainTextEditor({
  active,
  defaultValue,
  resourcePath,
  chapterId,
}: {
  active: boolean;
  defaultValue: string;
  resourcePath?: string;
  chapterId?: string;
}) {
  const { caretPositionAtom, selectionSnapshotAtom } = useMolecule(editorTabMolecule);
  const selectionSnapshot = useAtomValue(selectionSnapshotAtom);
  const setCaretPosition = useSetAtom(caretPositionAtom);
  const setSelectionSnapshot = useSetAtom(selectionSnapshotAtom);
  const resources = useResourceLibrary();
  const manuscript = useManuscript();

  const writeFile = useCallback(
    async (path: string, content: string) => {
      await resources.writeFile(path, content);
    },
    [resources],
  );

  const writeChapter = useCallback(
    async (id: string, content: string) => {
      await manuscript.writeChapter(id, content);
    },
    [manuscript],
  );

  const scheduleSave = useResourceAutosave(resourcePath, writeFile);
  const scheduleChapterSave = useTextAutosave(chapterId, writeChapter, "正文");

  return (
    <PlainTextEditor
      active={active}
      defaultValue={defaultValue}
      selectionSnapshot={selectionSnapshot}
      onSelectionSnapshotChange={setSelectionSnapshot}
      onCaretChange={setCaretPosition}
      onChange={
        resourcePath != null ? scheduleSave : chapterId != null ? scheduleChapterSave : undefined
      }
    />
  );
}

export function EditorTabPane({
  tabId,
  active,
  defaultValue,
  resourcePath,
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
          resourcePath={resourcePath}
          chapterId={chapterId}
        />
      </div>
    </ScopeProvider>
  );
}
