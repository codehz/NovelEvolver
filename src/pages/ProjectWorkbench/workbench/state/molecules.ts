import { createScope, molecule, use } from "bunshi";
import { useMolecule } from "bunshi/react";
import { RpcPromise } from "capnweb";
import { atom } from "jotai";

import { projectsService } from "#app/lib/app-rpc";
import { ProjectHandleWithMetadata } from "#shared/rpc/projects-rpc";

import type { EditorCaretPosition, EditorSelectionSnapshot } from "./editor-caret";
import type { WorkbenchEditorTab } from "./types";

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

  const tabsAtom = atom<WorkbenchEditorTab[]>([]);
  const activeTabIdAtom = atom<string | null>(null);

  const activeEditorTabAtom = atom((get) => {
    const tabs = get(tabsAtom);
    if (tabs.length === 0) {
      return undefined;
    }
    const activeId = get(activeTabIdAtom);
    if (activeId !== null) {
      const match = tabs.find((tab) => tab.id === activeId);
      if (match) {
        return match;
      }
    }
    return tabs[0];
  });

  return {
    tabsAtom,
    activeTabIdAtom,
    activeEditorTabAtom,
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
