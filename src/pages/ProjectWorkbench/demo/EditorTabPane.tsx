import { ScopeProvider, useMolecule } from "bunshi/react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";

import { PlainTextEditor } from "@/components/PlainTextEditor";
import { editorTabMolecule, editorTabScope } from "./workbench-editor-molecules";

type EditorTabPaneProps = {
  tabId: string;
  active: boolean;
  defaultValue: string;
};

function EditorTabPlainTextEditor({
  active,
  defaultValue,
}: {
  active: boolean;
  defaultValue: string;
}) {
  const { caretPositionAtom, selectionSnapshotAtom, documentAtom } = useMolecule(editorTabMolecule);
  const [document, setDocument] = useAtom(documentAtom);
  const selectionSnapshot = useAtomValue(selectionSnapshotAtom);
  const setCaretPosition = useSetAtom(caretPositionAtom);
  const setSelectionSnapshot = useSetAtom(selectionSnapshotAtom);

  useEffect(() => {
    if (document.length === 0 && defaultValue.length > 0) {
      setDocument(defaultValue);
    }
  }, [defaultValue, document.length, setDocument]);

  return (
    <PlainTextEditor
      active={active}
      value={document}
      onChange={setDocument}
      selectionSnapshot={selectionSnapshot}
      onSelectionSnapshotChange={setSelectionSnapshot}
      onCaretChange={setCaretPosition}
    />
  );
}

export function EditorTabPane({ tabId, active, defaultValue }: EditorTabPaneProps) {
  return (
    <ScopeProvider scope={editorTabScope} value={tabId}>
      <div
        className={active ? "flex min-h-0 min-w-0 flex-1 flex-col" : "hidden"}
        aria-hidden={!active}
      >
        <EditorTabPlainTextEditor active={active} defaultValue={defaultValue} />
      </div>
    </ScopeProvider>
  );
}
