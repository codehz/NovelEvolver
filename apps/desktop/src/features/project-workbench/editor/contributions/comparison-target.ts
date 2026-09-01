import type { HistoryTarget } from "@novelevolver/domain/worktree";

import { isMissingComparisonTargetError } from "#app/features/project-workbench/lib/comparison-errors";
import { contentTreeIconLayoutClass } from "#app/features/project-workbench/tree/content-tree-icons";
import { cn } from "#app/shared/lib/ui/cn";

import type { WorkbenchEditorTab, WorkbenchEditorTarget } from "../state/types";
import type { WorkbenchEditorResolveDeps, WorkbenchEditorTargetContribution } from "./types";

async function readComparisonTargetCurrentState(
  target: HistoryTarget,
  workspace: WorkbenchEditorResolveDeps["workspace"],
): Promise<{ content: string; canEditCurrent: boolean }> {
  try {
    const content =
      target.domain === "manuscript"
        ? await Promise.resolve(workspace.manuscript.readChapter(target.entityId))
        : await Promise.resolve(workspace.resources.readFile(target.entityId));
    return {
      content,
      canEditCurrent: true,
    };
  } catch (error) {
    if (isMissingComparisonTargetError(error)) {
      return {
        content: "",
        canEditCurrent: false,
      };
    }
    throw error;
  }
}

export const comparisonEditorContribution: WorkbenchEditorTargetContribution = {
  targetKind: "history-entry",
  tabKind: "comparison",
  iconClass: cn("icon-[codicon--diff]", "mr-1.5 text-ctp-green", contentTreeIconLayoutClass),
  label: (target) => {
    if (target.kind === "history-entry") {
      return `预览：${target.label}`;
    }
    if (target.kind === "commit-change") {
      const short = target.shortHash ?? target.commitHash.slice(0, 7);
      return `提交：${target.label}@${short}`;
    }
    const changeTarget = target as Extract<WorkbenchEditorTarget, { kind: "change" }>;
    return `更改：${changeTarget.label}`;
  },
  notificationSource: "历史",
  getTargetKey: (target) => {
    if (target.kind === "history-entry") {
      return `history-entry:${target.entryId}`;
    }
    if (target.kind === "commit-change") {
      return `commit-change:${target.commitHash}:${target.sourceTarget.domain}:${target.sourceTarget.entityId}`;
    }
    const changeTarget = target as Extract<WorkbenchEditorTarget, { kind: "change" }>;
    return `change:${changeTarget.sourceTarget.domain}:${changeTarget.sourceTarget.entityId}`;
  },
  getTabTargetKey: (tab) => {
    const comparisonTab = tab as Extract<WorkbenchEditorTab, { kind: "comparison" }>;
    if (comparisonTab.target.kind === "history-entry") {
      return `history-entry:${comparisonTab.target.entryId}`;
    }
    if (comparisonTab.target.kind === "commit-change") {
      return `commit-change:${comparisonTab.target.commitHash}:${comparisonTab.target.sourceTarget.domain}:${comparisonTab.target.sourceTarget.entityId}`;
    }
    return `change:${comparisonTab.target.sourceTarget.domain}:${comparisonTab.target.sourceTarget.entityId}`;
  },
  getHistoryTarget: (tab) => {
    const comparisonTab = tab as Extract<WorkbenchEditorTab, { kind: "comparison" }>;
    if (comparisonTab.target.kind === "history-entry") {
      return comparisonTab.target.sourceTarget;
    }
    if (comparisonTab.target.kind === "commit-change") {
      return comparisonTab.target.sourceTarget;
    }
    return comparisonTab.target.sourceTarget;
  },
  syncTabWithTree: (tab) => tab,
  areTabsEqual: (left, right) => {
    const comparisonTab = left as Extract<WorkbenchEditorTab, { kind: "comparison" }>;
    const candidate = right as Extract<WorkbenchEditorTab, { kind: "comparison" }>;
    return (
      comparisonTab.id === candidate.id &&
      comparisonTab.label === candidate.label &&
      comparisonTab.canEditCurrent === candidate.canEditCurrent &&
      comparisonTab.displayPath === candidate.displayPath &&
      comparisonTab.originalContent === candidate.originalContent &&
      comparisonTab.currentContent === candidate.currentContent &&
      JSON.stringify(comparisonTab.target) === JSON.stringify(candidate.target)
    );
  },
  resolveTarget: async (target, deps) => {
    const { workspace } = deps;

    if (target.kind === "history-entry") {
      const [historyContent, current] = await Promise.all([
        Promise.resolve(workspace.history.readHistoryEntryContent(target.entryId)),
        readComparisonTargetCurrentState(target.sourceTarget, workspace),
      ]);

      if (historyContent.content === null) {
        throw new Error("此记录没有可预览内容。");
      }

      return {
        tab: {
          id: `history-entry:${target.entryId}`,
          kind: "comparison",
          label: `预览：${target.label}`,
          canEditCurrent: current.canEditCurrent,
          target: {
            kind: "history-entry",
            sourceTarget: target.sourceTarget,
            entryId: target.entryId,
            entryMessage: target.message,
            entryTimestamp: target.timestamp,
            entryShortHash: target.shortHash,
          },
          displayPath: target.displayPath,
          originalContent: historyContent.content,
          currentContent: current.content,
        },
      };
    }

    if (target.kind === "commit-change") {
      const comparison = await Promise.resolve(
        workspace.history.readCommitChangeTextComparison(target.commitHash, target.sourceTarget),
      );
      const short = target.shortHash ?? target.commitHash.slice(0, 7);
      return {
        tab: {
          id: `commit-change:${target.commitHash}:${comparison.target.domain}:${comparison.target.entityId}`,
          kind: "comparison",
          label: `提交：${comparison.label}@${short}`,
          canEditCurrent: false,
          target: {
            kind: "commit-change",
            commitHash: target.commitHash,
            shortHash: target.shortHash,
            sourceTarget: comparison.target,
            changeId: comparison.changeId,
            changeKind: comparison.kind,
          },
          displayPath: comparison.displayPath,
          originalContent: comparison.originalContent,
          currentContent: comparison.currentContent,
        },
      };
    }

    const changeTarget = target as Extract<WorkbenchEditorTarget, { kind: "change" }>;
    const comparison = await Promise.resolve(
      workspace.changes.readChangeTextComparison(changeTarget.changeId),
    );
    return {
      tab: {
        id: `change:${comparison.target.domain}:${comparison.target.entityId}`,
        kind: "comparison",
        label: `更改：${comparison.label}`,
        canEditCurrent: true,
        target: {
          kind: "change",
          sourceTarget: comparison.target,
          changeId: comparison.changeId,
          changeKind: comparison.kind,
        },
        displayPath: comparison.displayPath,
        originalContent: comparison.originalContent,
        currentContent: comparison.currentContent,
      },
    };
  },
};
