import { useCallback } from "react";

import {
  isQuickPickDismissedError,
  quickPickApi,
  type QuickPickListItem,
} from "#app/shared/lib/quick-pick";
import type { BranchSummary } from "#shared/rpc/session/index";
import { useWorkbenchEditorActions } from "#workbench/editor/use-workbench-editor-actions";
import { useProjectContext } from "#workbench/state/molecules";

import { useBranchPickerSnapshot } from "./branch-data";
import { useActiveBranchName, useSetActiveBranchAtom } from "./branch-scopes";

function branchToListItem(branch: BranchSummary, activeBranchName: string): QuickPickListItem {
  const name = branch.name ?? "";
  return {
    id: name,
    label: name,
    detail: branch.commit ? branch.commit.slice(0, 7) : undefined,
    emphasized: name !== "" && name === activeBranchName,
  };
}

export function useBranchQuickPick() {
  const snapshot = useBranchPickerSnapshot();
  const project = useProjectContext();
  const activeBranchName = useActiveBranchName();
  const setActiveBranchName = useSetActiveBranchAtom();
  const { clearAllTabs } = useWorkbenchEditorActions();

  const run = useCallback(async () => {
    await snapshot.refresh();
    const branches = snapshot.data?.branches ?? [];

    const selectBranch = async (name: string) => {
      if (name === activeBranchName) {
        return;
      }
      clearAllTabs();
      await project.checkoutBranch(name);
      setActiveBranchName(name);
      await snapshot.refresh();
    };

    try {
      const listResult = await quickPickApi.showList({
        title: "分支切换器",
        searchLabel: "搜索或选择分支",
        searchPlaceholder: "选择要切换的分支…",
        emptyMessage: "无匹配分支",
        dismissAriaLabel: "关闭分支切换器",
        items: branches
          .filter((branch) => (branch.name ?? "") !== "")
          .map((branch) => branchToListItem(branch, activeBranchName)),
      });

      if (listResult.kind === "item") {
        await selectBranch(listResult.id);
      }
    } catch (error) {
      if (isQuickPickDismissedError(error)) {
        return;
      }
      throw error;
    }
  }, [activeBranchName, clearAllTabs, project, setActiveBranchName, snapshot]);

  return run;
}
