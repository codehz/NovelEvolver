import { useMolecule } from "bunshi/react";
import { useAtom } from "jotai";
import { useEffect } from "react";

import { useWorktreeTreeSnapshot } from "../branch/use-worktree-tree-snapshot";
import { workbenchEditorMolecule } from "../state/molecules";
import type { WorkbenchEditorTab } from "../state/types";
import { areWorkbenchEditorStatesEqual, normalizeWorkbenchEditorState } from "./editor-tab-manager";

export function useWorkbenchEditorTreeSync(): void {
  const snapshot = useWorktreeTreeSnapshot();
  const { editorStateAtom } = useMolecule(workbenchEditorMolecule);
  const [editorState, setEditorState] = useAtom(editorStateAtom);

  useEffect(() => {
    if (snapshot === null || editorState.tabs.length === 0) {
      return;
    }

    const nextTabs = editorState.tabs
      .map((tab): WorkbenchEditorTab | null => {
        if (tab.kind === "timeline-comparison") {
          return tab;
        }
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

    const nextState = normalizeWorkbenchEditorState({
      ...editorState,
      tabs: nextTabs,
    });
    if (areWorkbenchEditorStatesEqual(editorState, nextState)) {
      return;
    }

    setEditorState(nextState);
  }, [editorState, setEditorState, snapshot]);
}
