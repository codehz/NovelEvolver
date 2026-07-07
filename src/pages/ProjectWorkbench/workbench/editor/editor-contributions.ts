import type { RpcPromise } from "capnweb";

import { cn } from "#app/shared/lib/ui/cn";
import type { HistoryHandle, HistoryTarget } from "#shared/rpc/history-rpc";
import type { ManuscriptHandle } from "#shared/rpc/manuscript-rpc";
import type { ResourceLibraryHandle } from "#shared/rpc/resource-library-rpc";
import type { WorktreeChangesHandle } from "#shared/rpc/worktree-changes-rpc";
import type { WorktreeTreeSnapshot } from "#shared/rpc/worktree-tree-rpc";

import type {
  WorkbenchEditorDocument,
  WorkbenchEditorTab,
  WorkbenchEditorTarget,
} from "../state/types";
import { contentFileLeafIconClass, contentTreeIconLayoutClass } from "../tree/content-tree-icons";

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

function isMissingComparisonTargetError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.startsWith("Manuscript node does not exist:") ||
    error.message.startsWith("Manuscript chapter is missing:") ||
    error.message.startsWith("Resource node does not exist:") ||
    error.message.startsWith("Resource file is missing:")
  );
}

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

type WorkbenchEditorTargetContribution = {
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

const resourceEditorContribution: WorkbenchEditorTargetContribution = {
  targetKind: "resource",
  tabKind: "resource",
  iconClass: cn(contentFileLeafIconClass("file"), "mr-2"),
  label: () => "资源文件",
  notificationSource: "资源库",
  getTargetKey: (target) =>
    `resource:${(target as Extract<WorkbenchEditorTarget, { kind: "resource" }>).resourceId}`,
  getTabTargetKey: (tab) =>
    `resource:${(tab as Extract<WorkbenchEditorTab, { kind: "resource" }>).resourceId}`,
  getHistoryTarget: (tab) => ({
    domain: "resource",
    entityId: (tab as Extract<WorkbenchEditorTab, { kind: "resource" }>).resourceId,
  }),
  syncTabWithTree: (tab, snapshot) => {
    const resourceTab = tab as Extract<WorkbenchEditorTab, { kind: "resource" }>;
    const node = snapshot.resources.nodes[resourceTab.resourceId];
    if (node?.type !== "file") {
      return null;
    }

    return {
      ...resourceTab,
      label: node.name,
    };
  },
  areTabsEqual: (left, right) =>
    left.id === right.id &&
    left.label === right.label &&
    (left as Extract<WorkbenchEditorTab, { kind: "resource" }>).resourceId ===
      (right as Extract<WorkbenchEditorTab, { kind: "resource" }>).resourceId,
  resolveTarget: async (target, context) => {
    const resourceTarget = target as Extract<WorkbenchEditorTarget, { kind: "resource" }>;
    const node = context.snapshot?.resources.nodes[resourceTarget.resourceId];
    const label = node?.type === "file" ? node.name : "资源文件";
    const content = await Promise.resolve(context.resources.readFile(resourceTarget.resourceId));
    const key = `resource:${resourceTarget.resourceId}`;

    return {
      tab: {
        id: key,
        kind: "resource",
        resourceId: resourceTarget.resourceId,
        label,
      },
      document: {
        key,
        kind: "resource",
        resourceId: resourceTarget.resourceId,
        baselineContent: content,
      },
    };
  },
};

const manuscriptEditorContribution: WorkbenchEditorTargetContribution = {
  targetKind: "manuscript",
  tabKind: "manuscript",
  iconClass: cn(contentFileLeafIconClass("chapter"), "mr-2"),
  label: () => "章节",
  notificationSource: "正文",
  getTargetKey: (target) =>
    `manuscript:${(target as Extract<WorkbenchEditorTarget, { kind: "manuscript" }>).chapterId}`,
  getTabTargetKey: (tab) =>
    `manuscript:${(tab as Extract<WorkbenchEditorTab, { kind: "manuscript" }>).chapterId}`,
  getHistoryTarget: (tab) => ({
    domain: "manuscript",
    entityId: (tab as Extract<WorkbenchEditorTab, { kind: "manuscript" }>).chapterId,
  }),
  syncTabWithTree: (tab, snapshot) => {
    const manuscriptTab = tab as Extract<WorkbenchEditorTab, { kind: "manuscript" }>;
    const node = snapshot.manuscript.nodes[manuscriptTab.chapterId];
    if (node?.type !== "chapter") {
      return null;
    }

    return {
      ...manuscriptTab,
      label: node.title,
    };
  },
  areTabsEqual: (left, right) =>
    left.id === right.id &&
    left.label === right.label &&
    (left as Extract<WorkbenchEditorTab, { kind: "manuscript" }>).chapterId ===
      (right as Extract<WorkbenchEditorTab, { kind: "manuscript" }>).chapterId,
  resolveTarget: async (target, context) => {
    const manuscriptTarget = target as Extract<WorkbenchEditorTarget, { kind: "manuscript" }>;
    const node = context.snapshot?.manuscript.nodes[manuscriptTarget.chapterId];
    const label = node?.type === "chapter" ? node.title : "章节";
    const content = await Promise.resolve(
      context.manuscript.readChapter(manuscriptTarget.chapterId),
    );
    const key = `manuscript:${manuscriptTarget.chapterId}`;

    return {
      tab: {
        id: key,
        kind: "manuscript",
        chapterId: manuscriptTarget.chapterId,
        label,
      },
      document: {
        key,
        kind: "manuscript",
        chapterId: manuscriptTarget.chapterId,
        baselineContent: content,
      },
    };
  },
};

const comparisonEditorContribution: WorkbenchEditorTargetContribution = {
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

const workbenchEditorTargetContributions = [
  resourceEditorContribution,
  manuscriptEditorContribution,
  comparisonEditorContribution,
] as const;

function getWorkbenchEditorTargetContribution(
  target: WorkbenchEditorTarget,
): WorkbenchEditorTargetContribution {
  if (target.kind === "change") {
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
  context: WorkbenchEditorTargetContributionContext,
): Promise<ResolvedWorkbenchEditorTarget> {
  return getWorkbenchEditorTargetContribution(target).resolveTarget(target, context);
}
