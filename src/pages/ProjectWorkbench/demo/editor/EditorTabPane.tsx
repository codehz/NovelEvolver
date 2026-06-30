import { ScopeProvider, useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";

import { PlainTextEditor } from "@/components/PlainTextEditor";

import { useResourceAutosave } from "../../resource-library/use-resource-autosave";
import { useResourceLibraryHandle } from "../../resource-library/use-resource-library-handle";
import { editorTabMolecule, editorTabScope } from "../state/molecules";

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
  const library = useResourceLibraryHandle();

  const writeFile = useCallback(
    async (path: string, content: string) => {
      if (library.status !== "ready") {
        throw new Error("资源库未就绪");
      }
      await library.resources.writeFile(path, content);
    },
    [library],
  );

  const scheduleSave = useResourceAutosave(
    resourcePath,
    library.status === "ready" ? writeFile : undefined,
  );

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
        <EditorTabPlainTextEditor
          active={active}
          defaultValue={defaultValue}
          resourcePath={resourcePath}
        />
      </div>
    </ScopeProvider>
  );
}
