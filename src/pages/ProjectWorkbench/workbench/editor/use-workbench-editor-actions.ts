import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useRef } from "react";

import { notificationApi } from "#app/lib/notifications";

import {
  useHistory,
  useManuscript,
  useResourceLibrary,
  useWorktreeChanges,
} from "../branch/branch-scopes";
import { useWorktreeTreeSnapshot } from "../branch/use-worktree-tree-snapshot";
import { workbenchEditorMolecule } from "../state/molecules";
import type {
  WorkbenchEditorOpenIntent,
  WorkbenchEditorOpenOptions,
  WorkbenchEditorTarget,
} from "../state/types";
import {
  getWorkbenchEditorTargetKey,
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
  const { editorStateAtom, requestNavigation, tabsAtom } = useMolecule(workbenchEditorMolecule);
  const store = useStore();
  const tabs = useAtomValue(tabsAtom);
  const setEditorState = useSetAtom(editorStateAtom);
  const manuscript = useManuscript();
  const resources = useResourceLibrary();
  const changes = useWorktreeChanges();
  const history = useHistory();
  const snapshot = useWorktreeTreeSnapshot();
  const focusRequestIdRef = useRef(0);

  const openEditorTarget = useCallback(
    async (
      target: WorkbenchEditorTarget,
      intent: WorkbenchEditorOpenIntent,
      options?: WorkbenchEditorOpenOptions,
    ) => {
      const targetKey = getWorkbenchEditorTargetKey(target);
      const navigationRequest =
        options?.navigation === undefined ? undefined : { targetKey, ...options.navigation };
      const currentState = store.get(editorStateAtom);
      const existing = findWorkbenchEditorTabByTarget(currentState, target);
      if (existing !== undefined) {
        setEditorState((state) => openWorkbenchEditorTab(state, existing, intent));
        if (navigationRequest !== undefined) {
          requestNavigation(navigationRequest);
        }
        return;
      }

      const requestId =
        intent === "focus" ? (focusRequestIdRef.current += 1) : focusRequestIdRef.current;

      try {
        const { document, tab } = await resolveWorkbenchEditorTarget(target, {
          manuscript,
          resources,
          changes,
          history,
          snapshot,
        });
        if (intent === "focus" && requestId !== focusRequestIdRef.current) {
          return;
        }
        setEditorState((state) => openWorkbenchEditorTab(state, tab, intent, document));
        if (navigationRequest !== undefined) {
          requestNavigation(navigationRequest);
        }
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
    [
      editorStateAtom,
      manuscript,
      changes,
      requestNavigation,
      resources,
      setEditorState,
      snapshot,
      store,
      history,
    ],
  );

  const focusTarget = useCallback(
    (target: WorkbenchEditorTarget, options?: WorkbenchEditorOpenOptions) => {
      void openEditorTarget(target, "focus", options);
    },
    [openEditorTarget],
  );

  const openTarget = useCallback(
    (target: WorkbenchEditorTarget, options?: WorkbenchEditorOpenOptions) => {
      void openEditorTarget(target, "open", options);
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
