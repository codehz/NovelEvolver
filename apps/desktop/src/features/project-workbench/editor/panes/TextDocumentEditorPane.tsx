import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useRef, useState } from "react";

import {
  PlainTextEditor,
  type PlainTextEditorHandle,
} from "#app/features/project-workbench/editor/PlainTextEditor";
import { useOneShotRequestConsumer } from "#app/shared/lib/ui/one-shot-request";

import { getWorkbenchEditorTabTargetKey } from "../contributions/registry";
import { editorTabMolecule, workbenchEditorMolecule } from "../state/molecules";
import type { ContentWorkbenchEditorTab } from "../state/types";
import type { WorkbenchEditorDocumentRuntime } from "../use-workbench-editor-document-runtime";
import type { WorkbenchEditorPaneProps } from "./types";

type TextDocumentEditorPaneProps = WorkbenchEditorPaneProps & { tab: ContentWorkbenchEditorTab };

export function TextDocumentEditorPane({
  tab,
  active,
  transient,
  documentRuntime,
}: TextDocumentEditorPaneProps) {
  const { caretPositionAtom, selectionSnapshotAtom } = useMolecule(editorTabMolecule);
  const { onNavigationRequest, retryPendingNavigation } = useMolecule(workbenchEditorMolecule);
  const selectionSnapshot = useAtomValue(selectionSnapshotAtom);
  const setCaretPosition = useSetAtom(caretPositionAtom);
  const setSelectionSnapshot = useSetAtom(selectionSnapshotAtom);
  const document = documentRuntime.getDocument(tab);
  const editorRef = useRef<PlainTextEditorHandle | null>(null);
  const [hasEditor, setHasEditor] = useState(false);
  const targetKey = getWorkbenchEditorTabTargetKey(tab);
  const registerEditor = useCallback(
    (handle: Parameters<WorkbenchEditorDocumentRuntime["registerEditor"]>[1]) => {
      editorRef.current = handle;
      setHasEditor(handle !== null);
      documentRuntime.registerEditor(tab, handle);
    },
    [documentRuntime, tab],
  );
  const handleChange = useCallback(() => {
    documentRuntime.handleContentChange(tab, transient);
  }, [documentRuntime, tab, transient]);

  useOneShotRequestConsumer({
    subscribe: onNavigationRequest,
    replay: retryPendingNavigation,
    retryDeps: [active, hasEditor, targetKey],
    consume: (request) => {
      if (request.targetKey !== targetKey) {
        return "skip";
      }
      if (request.kind !== "text-range") {
        return "skip";
      }
      if (!active || editorRef.current === null) {
        return "retry";
      }
      const applied = editorRef.current.applySelection(request.selection, {
        focus: true,
        scrollIntoView: true,
      });
      return applied ? "done" : "retry";
    },
  });

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
