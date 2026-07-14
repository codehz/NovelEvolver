import { useMolecule } from "bunshi/react";
import { useAtom } from "jotai";
import type { RefObject } from "react";
import { useEffect, useRef } from "react";

import { useManuscript, useResourceLibrary } from "#workbench/branch/branch-scopes";
import type { PlainTextEditorHandle } from "#workbench/editor/PlainTextEditor";
import { useWorktreeChangesRevision } from "#workbench/worktree/use-worktree-changes-revision";

import { syncWorkbenchEditorDocument } from "./editor-document-contributions";
import { areWorkbenchEditorStatesEqual, normalizeWorkbenchEditorState } from "./editor-tab-manager";
import { workbenchEditorMolecule } from "./state/molecules";

export function useWorkbenchEditorDocumentSync(
  editorHandlesRef: RefObject<Map<string, PlainTextEditorHandle>>,
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
      documents.map((document) => {
        const editorHandle = editorHandlesRef.current.get(document.key);
        return syncWorkbenchEditorDocument(document, editorHandle, {
          manuscript,
          resources,
        }).catch(() => document);
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
  }, [editorHandlesRef, manuscript, resources, revision, setEditorState]);
}
