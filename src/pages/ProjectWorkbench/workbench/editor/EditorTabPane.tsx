import { ScopeProvider, useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";

import { PlainTextEditor } from "#app/components/PlainTextEditor";

import { editorTabMolecule, editorTabScope } from "../state/molecules";
import type { ContentWorkbenchEditorTab, WorkbenchEditorTab } from "../state/types";
import { TimelineMergePreviewEditor } from "./TimelineMergePreviewEditor";
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
