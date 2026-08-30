import { useMolecule } from "bunshi/react";
import { useAtom } from "jotai";
import type { RefObject } from "react";
import { useEffect, useRef } from "react";

import type { PlainTextEditorHandle } from "#workbench/editor/PlainTextEditor";
import { useWorktreeChangesRevision } from "#workbench/session/changes-feed/use-worktree-changes-revision";
import { useManuscript, useResourceLibrary } from "#workbench/session/workspace-handles";

import { syncWorkbenchEditorDocument } from "./editor-document-contributions";
import { areWorkbenchEditorStatesEqual, normalizeWorkbenchEditorState } from "./editor-tab-manager";
import { workbenchEditorMolecule } from "./state/molecules";

export function useWorkbenchEditorDocumentSync(
  editorHandlesRef: RefObject<Map<string, PlainTextEditorHandle>>,
  autosaveTimersRef: RefObject<Map<string, ReturnType<typeof setTimeout>>>,
): void {
  const revision = useWorktreeChangesRevision();
  const manuscript = useManuscript();
  const resources = useResourceLibrary();
  const { editorStateAtom } = useMolecule(workbenchEditorMolecule);
  const [editorState, setEditorState] = useAtom(editorStateAtom);
  const editorStateRef = useRef(editorState);
  editorStateRef.current = editorState;

  useEffect(() => {
    let cancelled = false;
    const sourceState = editorStateRef.current;
    const documents = Object.values(sourceState.documents);

    if (documents.length === 0) {
      return;
    }

    void Promise.all(
      documents.map(async (document) => {
        const editorHandle = editorHandlesRef.current.get(document.key);
        const valueBeforeSync = editorHandle?.getValue();
        try {
          const nextDocument = await syncWorkbenchEditorDocument(document, editorHandle, {
            manuscript,
            resources,
          });
          // Force-reload (setValue) means server content won; drop any pending
          // autosave that still closes over the pre-replace dirty buffer.
          if (valueBeforeSync !== editorHandle?.getValue()) {
            const pending = autosaveTimersRef.current.get(document.key);
            if (pending !== undefined) {
              clearTimeout(pending);
              autosaveTimersRef.current.delete(document.key);
            }
          }
          return nextDocument;
        } catch {
          return document;
        }
      }),
    )
      .then((nextDocuments) => {
        if (cancelled) {
          return;
        }

        const syncedDocumentsByKey = new Map(
          nextDocuments.map((document) => [document.key, document]),
        );
        setEditorState((currentState) => {
          const nextState = normalizeWorkbenchEditorState({
            ...currentState,
            documents: Object.fromEntries(
              Object.entries(currentState.documents).map(([key, document]) => [
                key,
                syncedDocumentsByKey.get(key) ?? document,
              ]),
            ),
          });
          if (areWorkbenchEditorStatesEqual(currentState, nextState)) {
            return currentState;
          }

          return nextState;
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [autosaveTimersRef, editorHandlesRef, manuscript, resources, revision, setEditorState]);
}
