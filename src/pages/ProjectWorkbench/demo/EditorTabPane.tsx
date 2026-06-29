import { ScopeProvider, useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom } from "jotai";

import { PlainTextEditor } from "@/components/PlainTextEditor";
import { editorTabMolecule, editorTabScope } from "./molecules";

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
  const { caretPositionAtom, selectionSnapshotAtom } = useMolecule(editorTabMolecule);
  const selectionSnapshot = useAtomValue(selectionSnapshotAtom);
  const setCaretPosition = useSetAtom(caretPositionAtom);
  const setSelectionSnapshot = useSetAtom(selectionSnapshotAtom);

  return (
    <PlainTextEditor
      active={active}
      defaultValue={defaultValue}
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
