import { useMolecule } from "bunshi/react";
import { useAtom, useSetAtom } from "jotai";
import { useCallback } from "react";

import { notificationApi } from "#app/lib/notifications";
import type { ResourceNode } from "#shared/rpc/projects-rpc";

import { workbenchEditorMolecule } from "../state/molecules";
import { resourceTabLabel, type WorkbenchEditorTab } from "../state/types";

function matchesResourcePath(
  resourcePath: string,
  from: string,
  nodeType: ResourceNode["type"],
): boolean {
  if (nodeType === "file") {
    return resourcePath === from;
  }
  return resourcePath === from || resourcePath.startsWith(`${from}/`);
}

function remapResourcePath(
  resourcePath: string,
  from: string,
  to: string,
  nodeType: ResourceNode["type"],
): string {
  if (!matchesResourcePath(resourcePath, from, nodeType)) {
    return resourcePath;
  }
  if (nodeType === "file" || resourcePath === from) {
    return to;
  }
  return `${to}${resourcePath.slice(from.length)}`;
}

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
      const existing = tabs.find(
        (tab) => tab.kind === "resource" && tab.resourcePath === resourcePath,
      );
      if (existing) {
        activateTab(existing.id);
        return;
      }

      try {
        const content = await readFile(resourcePath);
        const newTab: WorkbenchEditorTab = {
          id: `resource:${crypto.randomUUID()}`,
          kind: "resource",
          resourcePath,
          label: resourceTabLabel(resourcePath),
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
    [activateTab, setActiveTabId, setTabs, tabs],
  );

  const openManuscriptTab = useCallback(
    async (chapterId: string, title: string, readChapter: (id: string) => Promise<string>) => {
      const existing = tabs.find((tab) => tab.kind === "manuscript" && tab.chapterId === chapterId);
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
    [activateTab, setActiveTabId, setTabs, tabs],
  );

  const rebindResourcePaths = useCallback(
    (from: string, to: string, nodeType: ResourceNode["type"]) => {
      setTabs((current) =>
        current.map((tab) => {
          if (tab.kind !== "resource") {
            return tab;
          }
          const nextPath = remapResourcePath(tab.resourcePath, from, to, nodeType);
          if (nextPath === tab.resourcePath) {
            return tab;
          }
          return {
            ...tab,
            resourcePath: nextPath,
            label: resourceTabLabel(nextPath),
          };
        }),
      );
    },
    [setTabs],
  );

  const renameManuscriptTab = useCallback(
    (chapterId: string, title: string) => {
      setTabs((current) =>
        current.map((tab) =>
          tab.kind === "manuscript" && tab.chapterId === chapterId ? { ...tab, label: title } : tab,
        ),
      );
    },
    [setTabs],
  );

  const closeManuscriptTabs = useCallback(
    (chapterIds: readonly string[]) => {
      const idSet = new Set(chapterIds);
      setTabs((current) => {
        const next = current.filter(
          (tab) => tab.kind !== "manuscript" || !idSet.has(tab.chapterId),
        );
        const active = next.find((tab) => tab.active) ?? next[next.length - 1] ?? null;
        setActiveTabId(active?.id ?? null);
        return next.map((tab) => ({ ...tab, active: tab.id === active?.id }));
      });
    },
    [setActiveTabId, setTabs],
  );

  return {
    tabs,
    activateTab,
    clearAllTabs,
    closeTab,
    openResourceTab,
    openManuscriptTab,
    rebindResourcePaths,
    renameManuscriptTab,
    closeManuscriptTabs,
  };
}
