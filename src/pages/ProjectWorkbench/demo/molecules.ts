import { createScope, molecule, use } from "bunshi";
import { atom } from "jotai";

import { ProjectHandleWithMetadata } from "@shared/rpc/projects-rpc";
import { RpcPromise } from "capnweb";
import type { EditorCaretPosition, EditorSelectionSnapshot } from "./editor-caret";
import type { WorkbenchDemoTab } from "./types";

/** 每个项目工作台实例一条作用域链（多项目窗口互不干扰）。 */
export const projectScope = createScope<Awaited<RpcPromise<ProjectHandleWithMetadata>>>(
  null as never,
);

/** 每个已打开标签页一条作用域（value = tab id），caret 与文稿按 tab 隔离。 */
export const editorTabScope = createScope("");

const defaultCaret: EditorCaretPosition = { line: 1, column: 1, selectionLength: 0 };

export const workbenchEditorMolecule = molecule(() => {
  use(projectScope);

  const tabsAtom = atom<WorkbenchDemoTab[]>([]);
  const activeTabIdAtom = atom<string | null>(null);

  return {
    tabsAtom,
    activeTabIdAtom,
  };
});

export const projectMolecule = molecule(() => use(projectScope));

export const editorTabMolecule = molecule(() => {
  use(editorTabScope);

  const caretPositionAtom = atom<EditorCaretPosition>(defaultCaret);
  const selectionSnapshotAtom = atom<EditorSelectionSnapshot | null>(null);

  return {
    caretPositionAtom,
    selectionSnapshotAtom,
  };
});
