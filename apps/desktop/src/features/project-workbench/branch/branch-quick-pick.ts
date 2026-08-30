import { useCallback } from "react";

import { confirmDialogApi } from "#app/shared/lib/confirm-dialog";
import {
  isQuickPickDismissedError,
  quickPickApi,
  type QuickPickListItem,
} from "#app/shared/lib/quick-pick";
import type { BranchSummary } from "#domain/git/branch";
import { useWorkbenchEditorActions } from "#workbench/editor/use-workbench-editor-actions";
import { useActiveBranchName, useSetActiveBranchAtom } from "#workbench/session/branch-scope";
import { useProjectContext } from "#workbench/session/project-scope";

import { createBranchAndSwitch, deleteBranchByName, switchToBranch } from "./branch-actions";
import { useBranchPickerSnapshot } from "./branch-data";
import { promptNewBranchName } from "./branch-name-prompt";

function branchToListItem(branch: BranchSummary, activeBranchName: string): QuickPickListItem {
  const name = branch.name ?? "";
  return {
    id: name,
    label: name,
    detail: branch.commit ? branch.commit.slice(0, 7) : undefined,
    emphasized: name !== "" && name === activeBranchName,
  };
}

function namedBranches(branches: BranchSummary[]): BranchSummary[] {
  return branches.filter((branch) => (branch.name ?? "") !== "");
}

export function useBranchQuickPick() {
  const snapshot = useBranchPickerSnapshot();
  const project = useProjectContext();
  const activeBranchName = useActiveBranchName();
  const setActiveBranchName = useSetActiveBranchAtom();
  const { clearAllTabs } = useWorkbenchEditorActions();

  const run = useCallback(async () => {
    await snapshot.refresh();
    const latestBranches = namedBranches(
      (await Promise.resolve(project.branches)) as BranchSummary[],
    );

    try {
      const listResult = await quickPickApi.showList({
        title: "分支切换器",
        searchLabel: "搜索或选择分支",
        searchPlaceholder: "选择要切换的分支…",
        emptyMessage: "无匹配分支",
        dismissAriaLabel: "关闭分支切换器",
        extras: [
          { id: "create", label: "创建新分支…" },
          { id: "delete", label: "删除分支…" },
        ],
        items: latestBranches.map((branch) => branchToListItem(branch, activeBranchName)),
      });

      if (listResult.kind === "item") {
        await switchToBranch({
          name: listResult.id,
          activeBranchName,
          project,
          setActiveBranchName,
          clearAllTabs,
          refresh: () => snapshot.refresh(),
        });
        return;
      }

      if (listResult.id === "create") {
        const existing = namedBranches(
          (await Promise.resolve(project.branches)) as BranchSummary[],
        );
        const name = await promptNewBranchName({
          existing,
          initialValue: listResult.searchQuery,
        });
        await createBranchAndSwitch({
          name,
          activeBranchName,
          project,
          setActiveBranchName,
          clearAllTabs,
          refresh: () => snapshot.refresh(),
        });
        return;
      }

      if (listResult.id === "delete") {
        const deletable = namedBranches(
          (await Promise.resolve(project.branches)) as BranchSummary[],
        ).filter((branch) => (branch.name ?? "") !== activeBranchName);
        const deleteResult = await quickPickApi.showList({
          title: "删除分支",
          searchLabel: "搜索分支",
          searchPlaceholder: "选择要删除的分支…",
          emptyMessage: "没有可删除的分支",
          dismissAriaLabel: "取消删除分支",
          items: deletable.map((branch) => branchToListItem(branch, activeBranchName)),
        });
        if (deleteResult.kind !== "item") {
          return;
        }
        const targetName = deleteResult.id;
        const confirmed = await confirmDialogApi.confirm({
          title: "删除分支",
          description: `将永久删除分支「${targetName}」及其未提交草稿，此操作不可撤销。`,
          confirmLabel: "删除分支",
          tone: "danger",
        });
        if (!confirmed) {
          return;
        }
        await deleteBranchByName({
          name: targetName,
          project,
          refresh: () => snapshot.refresh(),
        });
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
