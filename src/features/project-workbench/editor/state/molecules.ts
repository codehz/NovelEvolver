import { createScope, molecule, use } from "bunshi";
import { atom } from "jotai";

import { createOneShotRequestChannel } from "#app/shared/lib/ui/one-shot-request";

import { projectIdScope } from "../../state/molecules";
import {
  areWorkbenchEditorDocumentsEqual,
  areWorkbenchEditorTabsEqual,
  emptyWorkbenchEditorState,
  normalizeWorkbenchEditorState,
} from "../editor-tab-manager";
import type { EditorCaretPosition, EditorSelectionSnapshot } from "./editor-caret";
import type {
  WorkbenchEditorDocuments,
  WorkbenchEditorNavigationRequest,
  WorkbenchEditorNavigationRequestResult,
  WorkbenchEditorState,
  WorkbenchEditorTab,
} from "./types";

/** 每个已打开标签页一条作用域（value = tab id），caret 与文稿按 tab 隔离。 */
export const editorTabScope = createScope("");

const defaultCaret: EditorCaretPosition = { line: 1, column: 1, selectionLength: 0 };

export const workbenchEditorMolecule = molecule(() => {
  use(projectIdScope);

  const tabsAtom = atom<WorkbenchEditorTab[]>(emptyWorkbenchEditorState.tabs);
  const documentsAtom = atom<WorkbenchEditorDocuments>(emptyWorkbenchEditorState.documents);
  const activeTabIdAtom = atom<string | null>(emptyWorkbenchEditorState.activeTabId);
  const transientTabIdAtom = atom<string | null>(emptyWorkbenchEditorState.transientTabId);

  /**
   * 聚合读写 atom：写路径拆到 tabs/documents/active/transient 切片，
   * 未变化的切片保持引用，避免无关消费者重渲。
   */
  const editorStateAtom = atom(
    (get) => ({
      tabs: get(tabsAtom),
      documents: get(documentsAtom),
      activeTabId: get(activeTabIdAtom),
      transientTabId: get(transientTabIdAtom),
    }),
    (
      get,
      set,
      update: WorkbenchEditorState | ((prev: WorkbenchEditorState) => WorkbenchEditorState),
    ) => {
      const prev: WorkbenchEditorState = {
        tabs: get(tabsAtom),
        documents: get(documentsAtom),
        activeTabId: get(activeTabIdAtom),
        transientTabId: get(transientTabIdAtom),
      };
      const next = normalizeWorkbenchEditorState(
        typeof update === "function" ? update(prev) : update,
      );

      if (!areWorkbenchEditorTabsEqual(prev.tabs, next.tabs)) {
        set(tabsAtom, next.tabs);
      }
      if (!areWorkbenchEditorDocumentsEqual(prev.documents, next.documents)) {
        set(documentsAtom, next.documents);
      }
      if (prev.activeTabId !== next.activeTabId) {
        set(activeTabIdAtom, next.activeTabId);
      }
      if (prev.transientTabId !== next.transientTabId) {
        set(transientTabIdAtom, next.transientTabId);
      }
    },
  );

  const activeEditorTabAtom = atom((get) => {
    const tabs = get(tabsAtom);
    const activeTabId = get(activeTabIdAtom);
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
