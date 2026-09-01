import type { BranchWorkspace } from "@novelevolver/desktop-rpc/session";
import type { HistoryTarget } from "@novelevolver/domain/worktree";
import type { WorktreeTreeSnapshot } from "@novelevolver/domain/worktree";
import type { RpcPromise } from "capnweb";

import type {
  WorkbenchEditorDocument,
  WorkbenchEditorTab,
  WorkbenchEditorTarget,
} from "../state/types";

export type ResolvedWorkbenchEditorTarget = {
  tab: WorkbenchEditorTab;
  document?: WorkbenchEditorDocument;
};

/**
 * 打开目标时的会话依赖：只暴露 workspace 根 + 树快照。
 * 各 contribution 自行取 manuscript/resources/changes/history，避免 actions 组装全量 handle 袋。
 */
export type WorkbenchEditorResolveDeps = {
  workspace: RpcPromise<BranchWorkspace>;
  snapshot: WorktreeTreeSnapshot | null;
};

export type WorkbenchEditorTargetContribution = {
  targetKind: WorkbenchEditorTarget["kind"];
  tabKind: WorkbenchEditorTab["kind"];
  iconClass: string;
  label: (target: WorkbenchEditorTarget) => string;
  notificationSource: string;
  getTargetKey: (target: WorkbenchEditorTarget) => string;
  getTabTargetKey: (tab: WorkbenchEditorTab) => string;
  getHistoryTarget: (tab: WorkbenchEditorTab) => HistoryTarget | null;
  syncTabWithTree: (
    tab: WorkbenchEditorTab,
    snapshot: WorktreeTreeSnapshot,
  ) => WorkbenchEditorTab | null;
  areTabsEqual: (left: WorkbenchEditorTab, right: WorkbenchEditorTab) => boolean;
  resolveTarget: (
    target: WorkbenchEditorTarget,
    deps: WorkbenchEditorResolveDeps,
  ) => Promise<ResolvedWorkbenchEditorTarget>;
};
