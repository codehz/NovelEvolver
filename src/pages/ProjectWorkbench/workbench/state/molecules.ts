import { createScope, molecule, use } from "bunshi";
import { useMolecule } from "bunshi/react";
import { RpcPromise } from "capnweb";
import { atom } from "jotai";

import { projectsService } from "#app/lib/app-rpc";
import { ProjectHandleWithMetadata } from "#shared/rpc/projects-rpc";

import { emptyWorkbenchEditorState } from "../editor/editor-tab-manager";
import type { EditorCaretPosition, EditorSelectionSnapshot } from "./editor-caret";
import type {
  WorkbenchEditorNavigationRequest,
  WorkbenchEditorNavigationRequestResult,
} from "./types";

export const projectIdScope = createScope<number>(-1);

export const projectMolecule = molecule(() => {
  const id = use(projectIdScope);

  return projectsService.openProject(id);
});

export function useProjectContext(): RpcPromise<ProjectHandleWithMetadata> {
  return useMolecule(projectMolecule);
}

/** 每个已打开标签页一条作用域（value = tab id），caret 与文稿按 tab 隔离。 */
export const editorTabScope = createScope("");

const defaultCaret: EditorCaretPosition = { line: 1, column: 1, selectionLength: 0 };

export const workbenchEditorMolecule = molecule(() => {
  use(projectIdScope);

  const editorStateAtom = atom(emptyWorkbenchEditorState);
  const tabsAtom = atom((get) => get(editorStateAtom).tabs);
  const documentsAtom = atom((get) => get(editorStateAtom).documents);
  const activeTabIdAtom = atom((get) => get(editorStateAtom).activeTabId);
  const transientTabIdAtom = atom((get) => get(editorStateAtom).transientTabId);

  const activeEditorTabAtom = atom((get) => {
    const { activeTabId, tabs } = get(editorStateAtom);
    if (tabs.length === 0) {
      return undefined;
    }
    if (activeTabId !== null) {
      const match = tabs.find((tab) => tab.id === activeTabId);
      if (match) {
        return match;
      }
    }
    return tabs[0];
  });

  const navigationHandlers = new Set<
    (request: WorkbenchEditorNavigationRequest) => WorkbenchEditorNavigationRequestResult
  >();
  let pendingNavigationRequest: WorkbenchEditorNavigationRequest | null = null;

  const dispatchPendingNavigationRequest = () => {
    const request = pendingNavigationRequest;
    if (request === null) {
      return;
    }
    for (const handler of navigationHandlers) {
      if (handler(request) === "done") {
        pendingNavigationRequest = null;
        return;
      }
    }
  };

  return {
    editorStateAtom,
    tabsAtom,
    documentsAtom,
    activeTabIdAtom,
    transientTabIdAtom,
    activeEditorTabAtom,
    requestNavigation: (request: WorkbenchEditorNavigationRequest): void => {
      pendingNavigationRequest = request;
      dispatchPendingNavigationRequest();
    },
    retryPendingNavigation: (): void => {
      dispatchPendingNavigationRequest();
    },
    onNavigationRequest: (
      handler: (
        request: WorkbenchEditorNavigationRequest,
      ) => WorkbenchEditorNavigationRequestResult,
    ): (() => void) => {
      navigationHandlers.add(handler);
      dispatchPendingNavigationRequest();
      return () => navigationHandlers.delete(handler);
    },
  };
});

export const editorTabMolecule = molecule(() => {
  use(projectIdScope);
  use(editorTabScope);

  const caretPositionAtom = atom<EditorCaretPosition>(defaultCaret);
  const selectionSnapshotAtom = atom<EditorSelectionSnapshot | null>(null);

  return {
    caretPositionAtom,
    selectionSnapshotAtom,
  };
});
