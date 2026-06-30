import { ProjectHandleWithMetadata } from "@shared/rpc/projects-rpc";
import { createScope, molecule, use } from "bunshi";
import { useMolecule } from "bunshi/react";
import { RpcPromise } from "capnweb";
import { nullthrow } from "foxact/nullthrow";
import { atom } from "jotai";

import { projectsService } from "@/lib/app-rpc";

import type { EditorCaretPosition, EditorSelectionSnapshot } from "./editor-caret";
import type { WorkbenchEditorTab } from "./types";

export const projectIdScope = createScope<number>(-1);

export const projectMolecule = molecule(() => {
  const id = use(projectIdScope);

  // use Promise.resolve to create a real Promise.
  return Promise.resolve(projectsService.openProject(id));
});

export const projectScope = createScope<Awaited<RpcPromise<ProjectHandleWithMetadata>> | null>(
  null,
);

/** ScopeProvider 注入后的当前项目（非 null）；供依赖 project × 其它 scope 的 molecule 复用。 */
export const projectContextMolecule = molecule(() => nullthrow(use(projectScope)));

export function useProjectContext(): Awaited<RpcPromise<ProjectHandleWithMetadata>> {
  return useMolecule(projectContextMolecule);
}

/** 每个已打开标签页一条作用域（value = tab id），caret 与文稿按 tab 隔离。 */
export const editorTabScope = createScope("");

const defaultCaret: EditorCaretPosition = { line: 1, column: 1, selectionLength: 0 };

export const workbenchEditorMolecule = molecule(() => {
  use(projectScope);

  const tabsAtom = atom<WorkbenchEditorTab[]>([]);
  const activeTabIdAtom = atom<string | null>(null);

  return {
    tabsAtom,
    activeTabIdAtom,
  };
});

export const editorTabMolecule = molecule(() => {
  use(editorTabScope);

  const caretPositionAtom = atom<EditorCaretPosition>(defaultCaret);
  const selectionSnapshotAtom = atom<EditorSelectionSnapshot | null>(null);

  return {
    caretPositionAtom,
    selectionSnapshotAtom,
  };
});
