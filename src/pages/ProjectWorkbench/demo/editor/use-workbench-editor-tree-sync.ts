import { useMolecule } from "bunshi/react";
import { useAtom, useSetAtom } from "jotai";
import { useEffect } from "react";

import { useWorktreeTreeSnapshot } from "../branch/use-worktree-tree-snapshot";
import { workbenchEditorMolecule } from "../state/molecules";
import type { WorkbenchEditorTab } from "../state/types";

function normalizeTabs(tabs: readonly WorkbenchEditorTab[]): readonly WorkbenchEditorTab[] {
  const activeId = tabs.find((tab) => tab.active)?.id ?? tabs[tabs.length - 1]?.id ?? null;
  return tabs.map((tab) => ({
    ...tab,
    active: tab.id === activeId,
  }));
}

function areTabsEqual(
  left: readonly WorkbenchEditorTab[],
  right: readonly WorkbenchEditorTab[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((tab, index) => {
    const candidate = right[index];
    if (candidate === undefined || tab.kind !== candidate.kind) {
      return false;
    }
    if (
      tab.id !== candidate.id ||
      tab.label !== candidate.label ||
      tab.active !== candidate.active ||
      tab.initialContent !== candidate.initialContent
    ) {
      return false;
    }
    if (tab.kind === "resource") {
      return candidate.kind === "resource" && tab.resourceId === candidate.resourceId;
    }
    return candidate.kind === "manuscript" && tab.chapterId === candidate.chapterId;
  });
}

export function useWorkbenchEditorTreeSync(): void {
  const snapshot = useWorktreeTreeSnapshot();
  const { tabsAtom, activeTabIdAtom } = useMolecule(workbenchEditorMolecule);
  const [tabs, setTabs] = useAtom(tabsAtom);
  const setActiveTabId = useSetAtom(activeTabIdAtom);

  useEffect(() => {
    if (snapshot === null || tabs.length === 0) {
      return;
    }

    const nextTabs = tabs
      .map((tab): WorkbenchEditorTab | null => {
        if (tab.kind === "manuscript") {
          const node = snapshot.manuscript.nodes[tab.chapterId];
          if (node?.type !== "chapter") {
            return null;
          }
          return {
            ...tab,
            label: node.title,
          };
        }

        const node = snapshot.resources.nodes[tab.resourceId];
        if (node?.type !== "file") {
          return null;
        }
        return {
          ...tab,
          label: node.name,
        };
      })
      .filter((tab): tab is WorkbenchEditorTab => tab !== null);

    const normalizedTabs = normalizeTabs(nextTabs);
    if (areTabsEqual(tabs, normalizedTabs)) {
      return;
    }

    const activeId = normalizedTabs.find((tab) => tab.active)?.id ?? null;
    setActiveTabId(activeId);
    setTabs(normalizedTabs.slice());
  }, [setActiveTabId, setTabs, snapshot, tabs]);
}
