import { useAtomValue } from "jotai";

import {
  demoHeadOverrideAtom,
  isDemoOnlyBranch,
  useBranchPickerSnapshot,
  useEffectiveHeadName,
} from "../demo/branch/branch-data";

export type ResourceLibraryAvailability =
  | { status: "no-branch"; message: string }
  | { status: "demo-branch"; branchName: string; message: string }
  | { status: "ready"; branchName: string };

export function useResourceLibraryAvailability(): ResourceLibraryAvailability {
  const branchName = useEffectiveHeadName();
  const override = useAtomValue(demoHeadOverrideAtom);
  const snapshot = useBranchPickerSnapshot();

  if (branchName == null || branchName === "") {
    return { status: "no-branch", message: "当前仓库尚无可用分支，无法打开资源库。" };
  }

  const serverBranches = snapshot.data?.branches ?? [];
  if (override != null && isDemoOnlyBranch(branchName, serverBranches)) {
    return {
      status: "demo-branch",
      branchName,
      message: "演示分支未接入仓库，请切换到真实分支后使用资源库。",
    };
  }

  return { status: "ready", branchName };
}
