import { notificationApi } from "#app/shared/lib/notifications";
import type { BranchSummary } from "#shared/rpc/session/index";

/** RpcPromise 兼容的分支操作面：方法返回值经 Promise.resolve 解包。 */
export type BranchProjectClient = {
  checkoutBranch(name: string): unknown;
  createBranch(name: string, startCommit?: string): unknown;
  deleteBranch(name: string): unknown;
};

export type SwitchToBranchParams = {
  name: string;
  activeBranchName: string;
  project: BranchProjectClient;
  setActiveBranchName: (name: string) => void;
  clearAllTabs: () => void;
  refresh?: () => void | Promise<void>;
};

export async function switchToBranch({
  name,
  activeBranchName,
  project,
  setActiveBranchName,
  clearAllTabs,
  refresh,
}: SwitchToBranchParams): Promise<boolean> {
  if (name === activeBranchName) {
    return true;
  }
  try {
    clearAllTabs();
    await Promise.resolve(project.checkoutBranch(name));
    setActiveBranchName(name);
    if (refresh !== undefined) {
      await Promise.resolve(refresh());
    }
    return true;
  } catch (error) {
    notificationApi.error(error instanceof Error ? error.message : "切换分支失败", {
      source: "分支",
    });
    return false;
  }
}

export async function createBranchAndSwitch(params: {
  name: string;
  activeBranchName: string;
  project: BranchProjectClient;
  setActiveBranchName: (name: string) => void;
  clearAllTabs: () => void;
  refresh?: () => void | Promise<void>;
  /** 完整 commit SHA；未传则从当前 HEAD tip 创建。 */
  startCommit?: string;
}): Promise<BranchSummary | null> {
  try {
    const created = (await Promise.resolve(
      params.project.createBranch(params.name, params.startCommit),
    )) as BranchSummary;
    const switched = await switchToBranch({
      name: params.name,
      activeBranchName: params.activeBranchName,
      project: params.project,
      setActiveBranchName: params.setActiveBranchName,
      clearAllTabs: params.clearAllTabs,
      refresh: params.refresh,
    });
    return switched ? created : null;
  } catch (error) {
    notificationApi.error(error instanceof Error ? error.message : "创建分支失败", {
      source: "分支",
    });
    return null;
  }
}

export async function deleteBranchByName(params: {
  name: string;
  project: BranchProjectClient;
  refresh?: () => void | Promise<void>;
}): Promise<boolean> {
  try {
    await Promise.resolve(params.project.deleteBranch(params.name));
    if (params.refresh !== undefined) {
      await Promise.resolve(params.refresh());
    }
    return true;
  } catch (error) {
    notificationApi.error(error instanceof Error ? error.message : "删除分支失败", {
      source: "分支",
    });
    return false;
  }
}
