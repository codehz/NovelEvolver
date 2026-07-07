import { cn } from "#app/shared/lib/ui/cn";
import type { HistoryTarget } from "#shared/rpc/history-rpc";
import { isMissingComparisonTargetError } from "#workbench/lib/comparison-errors";

import { contentTreeIconLayoutClass } from "../../tree/content-tree-icons";
import type { WorkbenchEditorTab, WorkbenchEditorTarget } from "../state/types";
import type {
  WorkbenchEditorTargetContribution,
  WorkbenchEditorTargetContributionContext,
} from "./types";

async function readComparisonTargetCurrentState(
  target: HistoryTarget,
  context: Pick<WorkbenchEditorTargetContributionContext, "manuscript" | "resources">,
): Promise<{ content: string; canEditCurrent: boolean }> {
  try {
    const content =
      target.domain === "manuscript"
        ? await Promise.resolve(context.manuscript.readChapter(target.entityId))
        : await Promise.resolve(context.resources.readFile(target.entityId));
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
  iconClass: cn("icon-[codicon--diff]", "mr-2 text-ctp-green", contentTreeIconLayoutClass),
  label: (target) => {
    if (target.kind === "history-entry") {
      return `预览：${target.label}`;
    }
    const changeTarget = target as Extract<WorkbenchEditorTarget, { kind: "change" }>;
    return `更改：${changeTarget.label}`;
  },
  notificationSource: "历史",
  getTargetKey: (target) =>
    target.kind === "history-entry"
      ? `history-entry:${target.entryId}`
      : `change:${
          (target as Extract<WorkbenchEditorTarget, { kind: "change" }>).sourceTarget.domain
        }:${(target as Extract<WorkbenchEditorTarget, { kind: "change" }>).sourceTarget.entityId}`,
  getTabTargetKey: (tab) =>
    (() => {
      const comparisonTab = tab as Extract<WorkbenchEditorTab, { kind: "comparison" }>;
      return comparisonTab.target.kind === "history-entry"
        ? `history-entry:${comparisonTab.target.entryId}`
        : `change:${comparisonTab.target.sourceTarget.domain}:${comparisonTab.target.sourceTarget.entityId}`;
    })(),
  getHistoryTarget: (tab) =>
    (() => {
      const comparisonTab = tab as Extract<WorkbenchEditorTab, { kind: "comparison" }>;
      return comparisonTab.target.kind === "history-entry"
        ? comparisonTab.target.sourceTarget
        : comparisonTab.target.sourceTarget;
    })(),
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
  resolveTarget: async (target, context) => {
    if (target.kind === "history-entry") {
      const [historyContent, current] = await Promise.all([
        Promise.resolve(context.history.readHistoryEntryContent(target.entryId)),
        readComparisonTargetCurrentState(target.sourceTarget, context),
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

    const changeTarget = target as Extract<WorkbenchEditorTarget, { kind: "change" }>;
    const comparison = await Promise.resolve(
      context.changes.readChangeTextComparison(changeTarget.changeId),
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
