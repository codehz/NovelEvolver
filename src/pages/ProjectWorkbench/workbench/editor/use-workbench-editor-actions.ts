import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useRef } from "react";

import { notificationApi } from "#app/lib/notifications";

import { useManuscript, useResourceLibrary, useWorktreeTimeline } from "../branch/branch-scopes";
import { useWorktreeTreeSnapshot } from "../branch/use-worktree-tree-snapshot";
import { workbenchEditorMolecule } from "../state/molecules";
import type { WorkbenchEditorOpenIntent, WorkbenchEditorTarget } from "../state/types";
import {
  getWorkbenchEditorTargetLabel,
  getWorkbenchEditorTargetNotificationSource,
  resolveWorkbenchEditorTarget,
} from "./editor-contributions";
import {
  activateWorkbenchEditorTab,
  clearWorkbenchEditorTabs,
  closeWorkbenchEditorTab,
  findWorkbenchEditorTabByTarget,
  openWorkbenchEditorTab,
  pinWorkbenchEditorTab,
} from "./editor-tab-manager";

export function useWorkbenchEditorActions() {
  const { editorStateAtom, tabsAtom } = useMolecule(workbenchEditorMolecule);
  const store = useStore();
  const tabs = useAtomValue(tabsAtom);
  const setEditorState = useSetAtom(editorStateAtom);
  const manuscript = useManuscript();
  const resources = useResourceLibrary();
  const timeline = useWorktreeTimeline();
  const snapshot = useWorktreeTreeSnapshot();
  const focusRequestIdRef = useRef(0);

  const openEditorTarget = useCallback(
    async (target: WorkbenchEditorTarget, intent: WorkbenchEditorOpenIntent) => {
      const currentState = store.get(editorStateAtom);
      const existing = findWorkbenchEditorTabByTarget(currentState, target);
      if (existing !== undefined) {
        setEditorState((state) => openWorkbenchEditorTab(state, existing, intent));
        return;
      }

      const requestId =
        intent === "focus" ? (focusRequestIdRef.current += 1) : focusRequestIdRef.current;

      try {
        const { document, tab } = await resolveWorkbenchEditorTarget(target, {
          manuscript,
          resources,
          timeline,
          snapshot,
        });
        if (intent === "focus" && requestId !== focusRequestIdRef.current) {
          return;
        }
        setEditorState((state) => openWorkbenchEditorTab(state, tab, intent, document));
      } catch (error) {
        notificationApi.error(
          error instanceof Error
            ? error.message
            : `无法打开${getWorkbenchEditorTargetLabel(target)}`,
          {
            source: getWorkbenchEditorTargetNotificationSource(target),
          },
        );
      }
    },
    [editorStateAtom, manuscript, resources, setEditorState, snapshot, store, timeline],
  );

  const focusTarget = useCallback(
    (target: WorkbenchEditorTarget) => {
      void openEditorTarget(target, "focus");
    },
    [openEditorTarget],
  );

  const openTarget = useCallback(
    (target: WorkbenchEditorTarget) => {
      void openEditorTarget(target, "open");
    },
    [openEditorTarget],
  );

  const activateTab = useCallback(
    (tabId: string) => {
      setEditorState((state) => activateWorkbenchEditorTab(state, tabId));
    },
    [setEditorState],
  );

  const clearAllTabs = useCallback(() => {
    setEditorState(clearWorkbenchEditorTabs());
  }, [setEditorState]);

  const closeTab = useCallback(
    (tabId: string) => {
      setEditorState((state) => closeWorkbenchEditorTab(state, tabId));
    },
    [setEditorState],
  );

  const pinTab = useCallback(
    (tabId: string) => {
      setEditorState((state) => pinWorkbenchEditorTab(state, tabId));
    },
    [setEditorState],
  );

  return {
    tabs,
    activateTab,
    clearAllTabs,
    closeTab,
    focusTarget,
    openTarget,
    pinTab,
  };
}
