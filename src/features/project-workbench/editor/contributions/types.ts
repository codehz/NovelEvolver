import type { RpcPromise } from "capnweb";

import type { HistoryHandle, HistoryTarget } from "#shared/rpc/worktree/index";
import type { ManuscriptHandle } from "#shared/rpc/worktree/index";
import type { ResourceLibraryHandle } from "#shared/rpc/worktree/index";
import type { WorktreeChangesHandle } from "#shared/rpc/worktree/index";
import type { WorktreeTreeSnapshot } from "#shared/rpc/worktree/index";

import type {
  WorkbenchEditorDocument,
  WorkbenchEditorTab,
  WorkbenchEditorTarget,
} from "../state/types";

export type ResolvedWorkbenchEditorTarget = {
  tab: WorkbenchEditorTab;
  document?: WorkbenchEditorDocument;
};

export type WorkbenchEditorTargetContributionContext = {
  manuscript: RpcPromise<ManuscriptHandle>;
  resources: RpcPromise<ResourceLibraryHandle>;
  changes: RpcPromise<WorktreeChangesHandle>;
  history: RpcPromise<HistoryHandle>;
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
    context: WorkbenchEditorTargetContributionContext,
  ) => Promise<ResolvedWorkbenchEditorTarget>;
};
