import { useMolecule } from "bunshi/react";
import { useAtom } from "jotai";
import { useEffect } from "react";

import { useWorktreeTreeSnapshot } from "../branch/use-worktree-tree-snapshot";
import { workbenchEditorMolecule } from "../state/molecules";
import type { WorkbenchEditorTab } from "../state/types";
import { syncWorkbenchEditorTabWithTree } from "./editor-contributions";
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
      .map((tab): WorkbenchEditorTab | null => syncWorkbenchEditorTabWithTree(tab, snapshot))
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
