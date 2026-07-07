import { createScope, molecule, use } from "bunshi";
import { useMolecule } from "bunshi/react";
import { RpcPromise } from "capnweb";
import { atom } from "jotai";

import { workspaceService } from "#app/lib/app-rpc";
import { createOneShotRequestChannel } from "#app/lib/one-shot-request";
import { ProjectSession } from "#shared/rpc/project-session-rpc";

import { emptyWorkbenchEditorState } from "../editor/editor-tab-manager";
import type { EditorCaretPosition, EditorSelectionSnapshot } from "./editor-caret";
import type {
  WorkbenchEditorNavigationRequest,
  WorkbenchEditorNavigationRequestResult,
} from "./types";

export const projectIdScope = createScope<number>(-1);

export const projectMolecule = molecule(() => {
  const id = use(projectIdScope);

  return workspaceService.openProject(id);
});

export function useProjectContext(): RpcPromise<ProjectSession> {
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

  const navigationChannel = createOneShotRequestChannel<WorkbenchEditorNavigationRequest>();

  return {
    editorStateAtom,
    tabsAtom,
    documentsAtom,
    activeTabIdAtom,
    transientTabIdAtom,
    activeEditorTabAtom,
    requestNavigation: (request: WorkbenchEditorNavigationRequest): void => {
      navigationChannel.publish(request);
    },
    retryPendingNavigation: (): void => {
      navigationChannel.replay();
    },
    onNavigationRequest: (
      handler: (
        request: WorkbenchEditorNavigationRequest,
      ) => WorkbenchEditorNavigationRequestResult,
    ): (() => void) => {
      return navigationChannel.subscribe(handler);
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
