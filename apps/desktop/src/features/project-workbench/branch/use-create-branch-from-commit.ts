import type { BranchSummary } from "@novelevolver/domain/git/branch";
import type { CommitSummary } from "@novelevolver/domain/worktree";
import { useCallback } from "react";

import { useWorkbenchEditorActions } from "#app/features/project-workbench/editor/use-workbench-editor-actions";
import {
  useActiveBranchName,
  useSetActiveBranchAtom,
} from "#app/features/project-workbench/session/branch-scope";
import { useProjectContext } from "#app/features/project-workbench/session/project-scope";
import { isQuickPickDismissedError } from "#app/shared/lib/quick-pick";

import { createBranchAndSwitch } from "./branch-actions";
import { useBranchPickerSnapshot } from "./branch-data";
import { promptNewBranchName } from "./branch-name-prompt";

function namedBranches(branches: BranchSummary[]): BranchSummary[] {
  return branches.filter((branch) => (branch.name ?? "") !== "");
}

/** 从指定提交创建分支并切换；供历史面板等调用。 */
export function useCreateBranchFromCommit() {
  const snapshot = useBranchPickerSnapshot();
  const project = useProjectContext();
  const activeBranchName = useActiveBranchName();
  const setActiveBranchName = useSetActiveBranchAtom();
  const { clearAllTabs } = useWorkbenchEditorActions();

  return useCallback(
    async (commit: CommitSummary) => {
      try {
        const existing = namedBranches(
          (await Promise.resolve(project.branches)) as BranchSummary[],
        );
        const name = await promptNewBranchName({
          existing,
          hint: `将从提交 ${commit.shortHash} 创建，并自动切换到新分支`,
        });
        await createBranchAndSwitch({
          name,
          activeBranchName,
          project,
          setActiveBranchName,
          clearAllTabs,
          refresh: () => snapshot.refresh(),
          startCommit: commit.hash,
        });
      } catch (error) {
        if (isQuickPickDismissedError(error)) {
          return;
        }
        throw error;
      }
    },
    [activeBranchName, clearAllTabs, project, setActiveBranchName, snapshot],
  );
}
