import { useMolecule } from "bunshi/react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";

import { useWorktreeTreeSnapshot } from "../branch/use-worktree-tree-snapshot";
import { workbenchEditorMolecule } from "../state/molecules";
import type { WorkbenchEditorTab } from "../state/types";
import { areWorkbenchEditorTabsEqual, normalizeWorkbenchEditorTabs } from "./editor-tab-state";

export function useWorkbenchEditorTreeSync(): void {
  const snapshot = useWorktreeTreeSnapshot();
  const { tabsAtom, activeTabIdAtom } = useMolecule(workbenchEditorMolecule);
  const [tabs, setTabs] = useAtom(tabsAtom);
  const activeTabId = useAtomValue(activeTabIdAtom);
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

    const { tabs: normalizedTabs, activeId } = normalizeWorkbenchEditorTabs(nextTabs, activeTabId);
    if (areWorkbenchEditorTabsEqual(tabs, normalizedTabs)) {
      return;
    }

    setActiveTabId(activeId);
    setTabs(normalizedTabs);
  }, [activeTabId, setActiveTabId, setTabs, snapshot, tabs]);
}
