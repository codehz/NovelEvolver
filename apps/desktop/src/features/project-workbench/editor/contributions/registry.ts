import type { HistoryTarget } from "@novelevolver/domain/worktree";
import type { WorktreeTreeSnapshot } from "@novelevolver/domain/worktree";

import type { WorkbenchEditorTab, WorkbenchEditorTarget } from "../state/types";
import { comparisonEditorContribution } from "./comparison-target";
import { manuscriptEditorContribution } from "./manuscript-target";
import { resourceEditorContribution } from "./resource-target";
import type {
  ResolvedWorkbenchEditorTarget,
  WorkbenchEditorResolveDeps,
  WorkbenchEditorTargetContribution,
} from "./types";

const workbenchEditorTargetContributions = [
  resourceEditorContribution,
  manuscriptEditorContribution,
  comparisonEditorContribution,
] as const;

function getWorkbenchEditorTargetContribution(
  target: WorkbenchEditorTarget,
): WorkbenchEditorTargetContribution {
  if (target.kind === "change" || target.kind === "commit-change") {
    return comparisonEditorContribution;
  }
  const contribution = workbenchEditorTargetContributions.find(
    (candidate) => candidate.targetKind === target.kind,
  );
  if (contribution === undefined) {
    throw new Error(`Unsupported workbench editor target kind: ${target.kind}`);
  }
  return contribution;
}

function getWorkbenchEditorTabContribution(
  tab: WorkbenchEditorTab,
): WorkbenchEditorTargetContribution {
  const contribution = workbenchEditorTargetContributions.find(
    (candidate) => candidate.tabKind === tab.kind,
  );
  if (contribution === undefined) {
    throw new Error(`Unsupported workbench editor tab kind: ${tab.kind}`);
  }
  return contribution;
}

export function getWorkbenchEditorTargetLabel(target: WorkbenchEditorTarget): string {
  return getWorkbenchEditorTargetContribution(target).label(target);
}

export function getWorkbenchEditorTargetNotificationSource(target: WorkbenchEditorTarget): string {
  return getWorkbenchEditorTargetContribution(target).notificationSource;
}

export function getWorkbenchEditorTargetKey(target: WorkbenchEditorTarget): string {
  return getWorkbenchEditorTargetContribution(target).getTargetKey(target);
}

export function getWorkbenchEditorTabIconClass(tab: WorkbenchEditorTab): string {
  return getWorkbenchEditorTabContribution(tab).iconClass;
}

export function getWorkbenchEditorTabTargetKey(tab: WorkbenchEditorTab): string {
  return getWorkbenchEditorTabContribution(tab).getTabTargetKey(tab);
}

export function getWorkbenchEditorTabHistoryTarget(tab: WorkbenchEditorTab): HistoryTarget | null {
  return getWorkbenchEditorTabContribution(tab).getHistoryTarget(tab);
}

export function syncWorkbenchEditorTabWithTree(
  tab: WorkbenchEditorTab,
  snapshot: WorktreeTreeSnapshot,
): WorkbenchEditorTab | null {
  return getWorkbenchEditorTabContribution(tab).syncTabWithTree(tab, snapshot);
}

export function areWorkbenchEditorTabsStructurallyEqual(
  left: WorkbenchEditorTab,
  right: WorkbenchEditorTab,
): boolean {
  const leftContribution = getWorkbenchEditorTabContribution(left);
  const rightContribution = getWorkbenchEditorTabContribution(right);
  if (leftContribution.tabKind !== rightContribution.tabKind) {
    return false;
  }
  return leftContribution.areTabsEqual(left, right);
}

export function resolveWorkbenchEditorTarget(
  target: WorkbenchEditorTarget,
  deps: WorkbenchEditorResolveDeps,
): Promise<ResolvedWorkbenchEditorTarget> {
  return getWorkbenchEditorTargetContribution(target).resolveTarget(target, deps);
}
