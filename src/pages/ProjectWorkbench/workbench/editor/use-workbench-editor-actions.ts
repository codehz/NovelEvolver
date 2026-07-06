import { useMolecule } from "bunshi/react";
import { useAtom, useSetAtom, useStore } from "jotai";
import { useCallback } from "react";

import { notificationApi } from "#app/lib/notifications";

import { workbenchEditorMolecule } from "../state/molecules";
import { type TimelinePreviewWorkbenchEditorTab, type WorkbenchEditorTab } from "../state/types";

export function useWorkbenchEditorActions() {
  const { tabsAtom, activeTabIdAtom } = useMolecule(workbenchEditorMolecule);
  const store = useStore();
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
        const closedWasActive = store.get(activeTabIdAtom) === tabId;
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
    [activeTabIdAtom, setActiveTabId, setTabs, store],
  );

  const openResourceTab = useCallback(
    async (
      resourceId: string,
      label: string,
      readFile: (resourceId: string) => Promise<string>,
    ) => {
      const existing = store
        .get(tabsAtom)
        .find((tab) => tab.kind === "resource" && tab.resourceId === resourceId);
      if (existing) {
        activateTab(existing.id);
        return;
      }

      try {
        const content = await readFile(resourceId);
        const newTab: WorkbenchEditorTab = {
          id: `resource:${crypto.randomUUID()}`,
          kind: "resource",
          resourceId,
          label,
          active: true,
          initialContent: content,
        };
        setActiveTabId(newTab.id);
        setTabs((current) => [...current.map((tab) => ({ ...tab, active: false })), newTab]);
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "无法打开资源库文件", {
          source: "资源库",
        });
      }
    },
    [activateTab, setActiveTabId, setTabs, store, tabsAtom],
  );

  const openManuscriptTab = useCallback(
    async (chapterId: string, title: string, readChapter: (id: string) => Promise<string>) => {
      const existing = store
        .get(tabsAtom)
        .find((tab) => tab.kind === "manuscript" && tab.chapterId === chapterId);
      if (existing) {
        activateTab(existing.id);
        return;
      }

      try {
        const content = await readChapter(chapterId);
        const newTab: WorkbenchEditorTab = {
          id: `manuscript:${chapterId}`,
          kind: "manuscript",
          chapterId,
          label: title,
          active: true,
          initialContent: content,
        };
        setActiveTabId(newTab.id);
        setTabs((current) => [...current.map((tab) => ({ ...tab, active: false })), newTab]);
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "无法打开章节", {
          source: "正文",
        });
      }
    },
    [activateTab, setActiveTabId, setTabs, store, tabsAtom],
  );

  const openTimelinePreviewTab = useCallback(
    (preview: Omit<TimelinePreviewWorkbenchEditorTab, "active">) => {
      const existing = store.get(tabsAtom).find((tab) => tab.id === preview.id);
      if (existing) {
        activateTab(existing.id);
        return;
      }

      const newTab: WorkbenchEditorTab = {
        ...preview,
        active: true,
      };
      setActiveTabId(newTab.id);
      setTabs((current) => [...current.map((tab) => ({ ...tab, active: false })), newTab]);
    },
    [activateTab, setActiveTabId, setTabs, store, tabsAtom],
  );

  return {
    tabs,
    activateTab,
    clearAllTabs,
    closeTab,
    openResourceTab,
    openManuscriptTab,
    openTimelinePreviewTab,
  };
}
