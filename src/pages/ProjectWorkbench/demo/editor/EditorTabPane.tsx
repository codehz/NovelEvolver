import { ScopeProvider, useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";

import { PlainTextEditor } from "#app/components/PlainTextEditor";

import { useResourceAutosave } from "../../resource-library/use-resource-autosave";
import { useResourceLibrary } from "../branch/branch-scopes";
import { editorTabMolecule, editorTabScope } from "../state/molecules";
import { EditorBreadcrumb } from "./EditorBreadcrumb";

type EditorTabPaneProps = {
  tabId: string;
  active: boolean;
  defaultValue: string;
  resourcePath?: string;
};

function EditorTabPlainTextEditor({
  active,
  defaultValue,
  resourcePath,
}: {
  active: boolean;
  defaultValue: string;
  resourcePath?: string;
}) {
  const { caretPositionAtom, selectionSnapshotAtom } = useMolecule(editorTabMolecule);
  const selectionSnapshot = useAtomValue(selectionSnapshotAtom);
  const setCaretPosition = useSetAtom(caretPositionAtom);
  const setSelectionSnapshot = useSetAtom(selectionSnapshotAtom);
  const resources = useResourceLibrary();

  const writeFile = useCallback(
    async (path: string, content: string) => {
      await resources.writeFile(path, content);
    },
    [resources],
  );

  const scheduleSave = useResourceAutosave(resourcePath, writeFile);

  return (
    <PlainTextEditor
      active={active}
      defaultValue={defaultValue}
      selectionSnapshot={selectionSnapshot}
      onSelectionSnapshotChange={setSelectionSnapshot}
      onCaretChange={setCaretPosition}
      onChange={resourcePath != null ? scheduleSave : undefined}
    />
  );
}

export function EditorTabPane({ tabId, active, defaultValue, resourcePath }: EditorTabPaneProps) {
  return (
    <ScopeProvider scope={editorTabScope} value={tabId}>
      <div
        className={active ? "flex min-h-0 min-w-0 flex-1 flex-col" : "hidden"}
        aria-hidden={!active}
      >
        <div className="flex h-8 shrink-0 items-center gap-1 bg-workbench-editor px-3 text-xs text-ctp-subtext0">
          <EditorBreadcrumb resourcePath={resourcePath ?? null} />
        </div>
        <EditorTabPlainTextEditor
          active={active}
          defaultValue={defaultValue}
          resourcePath={resourcePath}
        />
      </div>
    </ScopeProvider>
  );
}
