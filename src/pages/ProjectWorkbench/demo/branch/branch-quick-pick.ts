import type { BranchInfo } from "@shared/rpc/projects-rpc";
import { useAtom, useSetAtom } from "jotai";
import { useCallback } from "react";

import { notificationApi } from "@/lib/notifications";
import { isQuickPickDismissedError, quickPickApi, type QuickPickListItem } from "@/lib/quick-pick";

import {
  createDemoBranchInfo,
  demoCreatedBranchesAtom,
  demoHeadOverrideAtom,
  getBranchNameValidationError,
  isDemoOnlyBranch,
  mergeBranchLists,
  normalizeBranchNameInput,
  useBranchPickerSnapshot,
  useProjectContext,
} from "./branch-data";

export const BRANCH_QUICK_PICK_EXTRA_CREATE = "create-new-branch";

function branchToListItem(branch: BranchInfo, effectiveHeadName: string | null): QuickPickListItem {
  const name = branch.name ?? "";
  return {
    id: name,
    label: name,
    detail: branch.commit ? branch.commit.slice(0, 7) : undefined,
    emphasized: name !== "" && name === effectiveHeadName,
  };
}

export function useBranchQuickPick() {
  const snapshot = useBranchPickerSnapshot();
  const project = useProjectContext();
  const [demoCreated, setDemoCreated] = useAtom(demoCreatedBranchesAtom);
  const [demoHeadOverride, setDemoHeadOverride] = useAtom(demoHeadOverrideAtom);
  const setDemoHeadOverrideOnly = useSetAtom(demoHeadOverrideAtom);

  const run = useCallback(async () => {
    await snapshot.refresh();
    const serverBranches = snapshot.data?.branches ?? [];
    const serverHeadName = snapshot.data?.headName ?? null;
    const allBranches = mergeBranchLists(serverBranches, demoCreated);
    const effectiveHeadName = demoHeadOverride ?? serverHeadName;

    const selectBranch = async (name: string) => {
      if (name === effectiveHeadName) {
        return;
      }
      if (isDemoOnlyBranch(name, serverBranches)) {
        setDemoHeadOverrideOnly(name);
        return;
      }
      await project.handle.switchBranch(name);
      setDemoHeadOverride(null);
      await snapshot.refresh();
    };

    const commitCreateBranch = (rawName: string) => {
      const name = normalizeBranchNameInput(rawName);
      const validationError = getBranchNameValidationError(name, allBranches);
      if (validationError != null) {
        return validationError;
      }
      setDemoCreated((prev) => [...prev, createDemoBranchInfo(name)]);
      setDemoHeadOverride(name);
      notificationApi.info(`已创建并切换到分支「${name}」（演示，未写入仓库）`, {
        source: "分支",
      });
      return null;
    };

    try {
      const listResult = await quickPickApi.showList({
        title: "分支切换器",
        searchLabel: "搜索或选择分支",
        searchPlaceholder: "选择要切换的分支…",
        emptyMessage: "无匹配分支",
        dismissAriaLabel: "关闭分支切换器",
        items: allBranches
          .filter((branch) => (branch.name ?? "") !== "")
          .map((branch) => branchToListItem(branch, effectiveHeadName)),
        extras: [{ id: BRANCH_QUICK_PICK_EXTRA_CREATE, label: "创建新分支…" }],
      });

      if (listResult.kind === "item") {
        await selectBranch(listResult.id);
        return;
      }

      if (listResult.id !== BRANCH_QUICK_PICK_EXTRA_CREATE) {
        return;
      }

      const name = await quickPickApi.showInput({
        title: "创建新分支",
        inputLabel: "请提供新的分支名称",
        placeholder: "例如 feature/my-chapter",
        initialValue: normalizeBranchNameInput(listResult.searchQuery),
        hint: '请提供新的分支名称（按 "Enter" 以确认或按 "Esc" 以取消）',
        dismissAriaLabel: "关闭分支切换器",
        validate: (value) => getBranchNameValidationError(value, allBranches),
      });

      const createError = commitCreateBranch(name);
      if (createError != null) {
        notificationApi.warning(createError, { source: "分支" });
      }
    } catch (error) {
      if (isQuickPickDismissedError(error)) {
        return;
      }
      throw error;
    }
  }, [
    demoCreated,
    demoHeadOverride,
    project.handle,
    setDemoCreated,
    setDemoHeadOverride,
    setDemoHeadOverrideOnly,
    snapshot,
  ]);

  return run;
}
