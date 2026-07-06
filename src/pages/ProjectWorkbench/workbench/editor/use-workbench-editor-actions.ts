import { useMolecule } from "bunshi/react";
import { useAtom, useSetAtom, useStore } from "jotai";
import { useCallback } from "react";

import { notificationApi } from "#app/lib/notifications";

import { workbenchEditorMolecule } from "../state/molecules";
import { type TimelinePreviewWorkbenchEditorTab, type WorkbenchEditorTab } from "../state/types";

export type WorkbenchEditorOpenMode = "preview" | "permanent";

export type WorkbenchEditorOpenOptions = {
  mode: WorkbenchEditorOpenMode;
};

function openWorkbenchEditorTab(
  current: readonly WorkbenchEditorTab[],
  nextTab: WorkbenchEditorTab,
  mode: WorkbenchEditorOpenMode,
  matches: (tab: WorkbenchEditorTab) => boolean,
): { tabs: WorkbenchEditorTab[]; activeId: string } {
  const existingIndex = current.findIndex(matches);
  if (existingIndex >= 0) {
    const existing = current[existingIndex]!;
    const preview = mode === "permanent" ? false : existing.preview;
    return {
      activeId: existing.id,
      tabs: current.map((tab, index) =>
        index === existingIndex
          ? {
              ...nextTab,
              id: existing.id,
              active: true,
              preview,
            }
          : { ...tab, active: false },
      ),
    };
  }

  const tabToOpen: WorkbenchEditorTab = {
    ...nextTab,
    active: true,
    preview: mode === "preview",
  };
  if (mode === "preview") {
    const previewIndex = current.findIndex((tab) => tab.preview);
    if (previewIndex >= 0) {
      return {
        activeId: tabToOpen.id,
        tabs: current.map((tab, index) =>
          index === previewIndex ? tabToOpen : { ...tab, active: false },
        ),
      };
    }
  }

  return {
    activeId: tabToOpen.id,
    tabs: [...current.map((tab) => ({ ...tab, active: false })), tabToOpen],
  };
}

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

  const promoteTab = useCallback(
    (tabId: string) => {
      setTabs((current) =>
        current.map((tab) => (tab.id === tabId ? { ...tab, preview: false } : tab)),
      );
    },
    [setTabs],
  );

  const openResourceTab = useCallback(
    async (
      resourceId: string,
      label: string,
      readFile: (resourceId: string) => Promise<string>,
      options: WorkbenchEditorOpenOptions = { mode: "permanent" },
    ) => {
      const existing = store
        .get(tabsAtom)
        .find((tab) => tab.kind === "resource" && tab.resourceId === resourceId);
      if (existing) {
        setActiveTabId(existing.id);
        setTabs((current) =>
          current.map((tab) =>
            tab.id === existing.id
              ? {
                  ...tab,
                  active: true,
                  preview: options.mode === "permanent" ? false : tab.preview,
                }
              : { ...tab, active: false },
          ),
        );
        return;
      }

      try {
        const content = await readFile(resourceId);
        const newTab: WorkbenchEditorTab = {
          id: `resource:${resourceId}`,
          kind: "resource",
          resourceId,
          label,
          active: true,
          preview: options.mode === "preview",
          initialContent: content,
        };
        setTabs((current) => {
          const result = openWorkbenchEditorTab(
            current,
            newTab,
            options.mode,
            (tab) => tab.kind === "resource" && tab.resourceId === resourceId,
          );
          setActiveTabId(result.activeId);
          return result.tabs;
        });
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "无法打开资源库文件", {
          source: "资源库",
        });
      }
    },
    [setActiveTabId, setTabs, store, tabsAtom],
  );

  const openManuscriptTab = useCallback(
    async (
      chapterId: string,
      title: string,
      readChapter: (id: string) => Promise<string>,
      options: WorkbenchEditorOpenOptions = { mode: "permanent" },
    ) => {
      const existing = store
        .get(tabsAtom)
        .find((tab) => tab.kind === "manuscript" && tab.chapterId === chapterId);
      if (existing) {
        setActiveTabId(existing.id);
        setTabs((current) =>
          current.map((tab) =>
            tab.id === existing.id
              ? {
                  ...tab,
                  active: true,
                  preview: options.mode === "permanent" ? false : tab.preview,
                }
              : { ...tab, active: false },
          ),
        );
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
          preview: options.mode === "preview",
          initialContent: content,
        };
        setTabs((current) => {
          const result = openWorkbenchEditorTab(
            current,
            newTab,
            options.mode,
            (tab) => tab.kind === "manuscript" && tab.chapterId === chapterId,
          );
          setActiveTabId(result.activeId);
          return result.tabs;
        });
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "无法打开章节", {
          source: "正文",
        });
      }
    },
    [setActiveTabId, setTabs, store, tabsAtom],
  );

  const openTimelinePreviewTab = useCallback(
    (
      preview: Omit<TimelinePreviewWorkbenchEditorTab, "active" | "preview">,
      options: WorkbenchEditorOpenOptions = { mode: "permanent" },
    ) => {
      const newTab: WorkbenchEditorTab = {
        ...preview,
        active: true,
        preview: options.mode === "preview",
      };
      setTabs((current) => {
        const result = openWorkbenchEditorTab(
          current,
          newTab,
          options.mode,
          (tab) => tab.kind === "timeline-preview" && tab.entryId === preview.entryId,
        );
        setActiveTabId(result.activeId);
        return result.tabs;
      });
    },
    [setActiveTabId, setTabs],
  );

  return {
    tabs,
    activateTab,
    clearAllTabs,
    closeTab,
    promoteTab,
    openResourceTab,
    openManuscriptTab,
    openTimelinePreviewTab,
  };
}
