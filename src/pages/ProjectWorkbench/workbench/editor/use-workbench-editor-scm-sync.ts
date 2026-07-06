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
import { type ContentWorkbenchEditorTab, type WorkbenchEditorTab } from "../state/types";
import { areWorkbenchEditorStatesEqual, normalizeWorkbenchEditorState } from "./editor-tab-manager";

function applySyncedContent(
  tab: ContentWorkbenchEditorTab,
  content: string,
  editorHandle: PlainTextEditorHandle | undefined,
): WorkbenchEditorTab {
  const currentValue = editorHandle?.getValue();
  if (currentValue === content) {
    return {
      ...tab,
      initialContent: content,
    };
  }

  if (currentValue === undefined || currentValue === tab.initialContent) {
    editorHandle?.setValue(content);
    return {
      ...tab,
      initialContent: content,
    };
  }

  return tab;
}

async function syncManuscriptTab(
  tab: Extract<WorkbenchEditorTab, { kind: "manuscript" }>,
  manuscript: RpcPromise<ManuscriptHandle>,
  editorHandle: PlainTextEditorHandle | undefined,
): Promise<WorkbenchEditorTab | null> {
  const content = await Promise.resolve(manuscript.readChapter(tab.chapterId));
  return applySyncedContent(tab, content, editorHandle);
}

async function syncResourceTab(
  tab: Extract<WorkbenchEditorTab, { kind: "resource" }>,
  resources: RpcPromise<ResourceLibraryHandle>,
  editorHandle: PlainTextEditorHandle | undefined,
): Promise<WorkbenchEditorTab | null> {
  const content = await Promise.resolve(resources.readFile(tab.resourceId));
  return applySyncedContent(tab, content, editorHandle);
}

export function useWorkbenchEditorScmSync(
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

    if (sourceState.tabs.length === 0) {
      return;
    }

    void Promise.all(
      sourceState.tabs.map((tab) => {
        if (tab.kind === "timeline-comparison") {
          return Promise.resolve(tab);
        }
        const editorHandle = editorHandlesRef.current.get(tab.id);
        if (tab.kind === "manuscript") {
          return syncManuscriptTab(tab, manuscript, editorHandle).catch(() => tab);
        }
        return syncResourceTab(tab, resources, editorHandle).catch(() => tab);
      }),
    )
      .then((nextTabs) => {
        if (cancelled) {
          return;
        }

        const syncedTabsById = new Map(
          nextTabs
            .filter((tab): tab is WorkbenchEditorTab => tab !== null)
            .map((tab) => [tab.id, tab]),
        );
        setEditorState((currentState) => {
          const nextState = normalizeWorkbenchEditorState({
            ...currentState,
            tabs: currentState.tabs.map((tab) => syncedTabsById.get(tab.id) ?? tab),
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
