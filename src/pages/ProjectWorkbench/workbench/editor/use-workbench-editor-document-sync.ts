import { useMolecule } from "bunshi/react";
import type { RpcPromise } from "capnweb";
import { useAtom } from "jotai";
import type { RefObject } from "react";
import { useEffect, useRef } from "react";

import type { PlainTextEditorHandle } from "#app/components/PlainTextEditor";
import type { ManuscriptHandle } from "#shared/rpc/manuscript-rpc";
import type { ResourceLibraryHandle } from "#shared/rpc/resource-library-rpc";

import { useManuscript, useResourceLibrary } from "../branch/branch-scopes";
import { useWorktreeScmRevision } from "../branch/use-worktree-scm-revision";
import { workbenchEditorMolecule } from "../state/molecules";
import type { WorkbenchEditorDocument } from "../state/types";
import { areWorkbenchEditorStatesEqual, normalizeWorkbenchEditorState } from "./editor-tab-manager";

function applySyncedContent(
  document: WorkbenchEditorDocument,
  content: string,
  editorHandle: PlainTextEditorHandle | undefined,
): WorkbenchEditorDocument {
  const currentValue = editorHandle?.getValue();
  if (currentValue === content) {
    return {
      ...document,
      baselineContent: content,
    };
  }

  if (currentValue === undefined || currentValue === document.baselineContent) {
    editorHandle?.setValue(content);
    return {
      ...document,
      baselineContent: content,
    };
  }

  return document;
}

async function syncManuscriptDocument(
  document: Extract<WorkbenchEditorDocument, { kind: "manuscript" }>,
  manuscript: RpcPromise<ManuscriptHandle>,
  editorHandle: PlainTextEditorHandle | undefined,
): Promise<WorkbenchEditorDocument> {
  const content = await Promise.resolve(manuscript.readChapter(document.chapterId));
  return applySyncedContent(document, content, editorHandle);
}

async function syncResourceDocument(
  document: Extract<WorkbenchEditorDocument, { kind: "resource" }>,
  resources: RpcPromise<ResourceLibraryHandle>,
  editorHandle: PlainTextEditorHandle | undefined,
): Promise<WorkbenchEditorDocument> {
  const content = await Promise.resolve(resources.readFile(document.resourceId));
  return applySyncedContent(document, content, editorHandle);
}

export function useWorkbenchEditorDocumentSync(
  editorHandlesRef: RefObject<Map<string, PlainTextEditorHandle>>,
): void {
  const revision = useWorktreeScmRevision();
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
        if (document.kind === "manuscript") {
          return syncManuscriptDocument(document, manuscript, editorHandle).catch(() => document);
        }
        return syncResourceDocument(document, resources, editorHandle).catch(() => document);
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
