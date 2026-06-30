import { useMolecule } from "bunshi/react";
import { useAtom, useSetAtom } from "jotai";
import { useCallback } from "react";

import { notificationApi } from "@/lib/notifications";

import { workbenchEditorMolecule } from "../state/molecules";
import { resourceTabId, resourceTabLabel, type WorkbenchEditorTab } from "../state/types";

export function useWorkbenchEditorActions() {
  const { tabsAtom, activeTabIdAtom } = useMolecule(workbenchEditorMolecule);
  const [tabs, setTabs] = useAtom(tabsAtom);
  const setActiveTabId = useSetAtom(activeTabIdAtom);

  const activateTab = useCallback(
    (tabId: string) => {
      setActiveTabId(tabId);
      setTabs((current) =>
        current.map((tab) => ({
          ...tab,
          active: tab.id === tabId,
        })),
      );
    },
    [setActiveTabId, setTabs],
  );

  const clearAllTabs = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
  }, [setActiveTabId, setTabs]);

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((current) => {
        const next = current.filter((tab) => tab.id !== tabId);
        const closedWasActive = current.some((tab) => tab.id === tabId && tab.active);
        if (closedWasActive) {
          const fallback = next[next.length - 1];
          setActiveTabId(fallback?.id ?? null);
          return next.map((tab) => ({
            ...tab,
            active: tab.id === fallback?.id,
          }));
        }
        return next;
      });
    },
    [setActiveTabId, setTabs],
  );

  const openResourceTab = useCallback(
    async (resourcePath: string, readFile: (path: string) => Promise<string>) => {
      const id = resourceTabId(resourcePath);
      const existing = tabs.find((tab) => tab.id === id);
      if (existing) {
        activateTab(id);
        return;
      }

      try {
        const content = await readFile(resourcePath);
        const newTab: WorkbenchEditorTab = {
          id,
          kind: "resource",
          resourcePath,
          label: resourceTabLabel(resourcePath),
          active: true,
          initialContent: content,
        };
        setActiveTabId(id);
        setTabs((current) => [...current.map((tab) => ({ ...tab, active: false })), newTab]);
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "无法打开资源库文件", {
          source: "资源库",
        });
      }
    },
    [activateTab, setActiveTabId, setTabs, tabs],
  );

  return {
    tabs,
    activateTab,
    clearAllTabs,
    closeTab,
    openResourceTab,
  };
}
