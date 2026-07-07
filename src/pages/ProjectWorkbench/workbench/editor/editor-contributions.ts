import type { RpcPromise } from "capnweb";

import type { ManuscriptHandle } from "#shared/rpc/manuscript-rpc";
import type { ResourceLibraryHandle } from "#shared/rpc/resource-library-rpc";
import type { WorktreeTimelineHandle } from "#shared/rpc/worktree-timeline-rpc";
import type { WorktreeTreeSnapshot } from "#shared/rpc/worktree-tree-rpc";

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
  timeline: RpcPromise<WorktreeTimelineHandle>;
  snapshot: WorktreeTreeSnapshot | null;
};

type WorkbenchEditorTargetContribution = {
  targetKind: WorkbenchEditorTarget["kind"];
  tabKind: WorkbenchEditorTab["kind"];
  label: (target: WorkbenchEditorTarget) => string;
  notificationSource: string;
  getTargetKey: (target: WorkbenchEditorTarget) => string;
  getTabTargetKey: (tab: WorkbenchEditorTab) => string;
  resolveTarget: (
    target: WorkbenchEditorTarget,
    context: WorkbenchEditorTargetContributionContext,
  ) => Promise<ResolvedWorkbenchEditorTarget>;
};

const resourceEditorContribution: WorkbenchEditorTargetContribution = {
  targetKind: "resource",
  tabKind: "resource",
  label: () => "资源文件",
  notificationSource: "资源库",
  getTargetKey: (target) =>
    `resource:${(target as Extract<WorkbenchEditorTarget, { kind: "resource" }>).resourceId}`,
  getTabTargetKey: (tab) =>
    `resource:${(tab as Extract<WorkbenchEditorTab, { kind: "resource" }>).resourceId}`,
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
  label: () => "章节",
  notificationSource: "正文",
  getTargetKey: (target) =>
    `manuscript:${(target as Extract<WorkbenchEditorTarget, { kind: "manuscript" }>).chapterId}`,
  getTabTargetKey: (tab) =>
    `manuscript:${(tab as Extract<WorkbenchEditorTab, { kind: "manuscript" }>).chapterId}`,
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

const timelineComparisonEditorContribution: WorkbenchEditorTargetContribution = {
  targetKind: "timeline-entry",
  tabKind: "timeline-comparison",
  label: (target) =>
    `预览：${(target as Extract<WorkbenchEditorTarget, { kind: "timeline-entry" }>).label}`,
  notificationSource: "时间线",
  getTargetKey: (target) =>
    `timeline-entry:${(target as Extract<WorkbenchEditorTarget, { kind: "timeline-entry" }>).entryId}`,
  getTabTargetKey: (tab) =>
    `timeline-entry:${(tab as Extract<WorkbenchEditorTab, { kind: "timeline-comparison" }>).entryId}`,
  resolveTarget: async (target, context) => {
    const timelineTarget = target as Extract<WorkbenchEditorTarget, { kind: "timeline-entry" }>;
    const currentContent = (
      timelineTarget.sourceTarget.domain === "manuscript"
        ? Promise.resolve(context.manuscript.readChapter(timelineTarget.sourceTarget.entityId))
        : Promise.resolve(context.resources.readFile(timelineTarget.sourceTarget.entityId))
    ).catch((error: unknown) => {
      if (timelineTarget.entryKind === "delete") {
        return "";
      }
      throw error;
    });
    const [historyContent, current] = await Promise.all([
      Promise.resolve(context.timeline.readTimelineEntryContent(timelineTarget.entryId)),
      currentContent,
    ]);

    if (historyContent.content === null) {
      throw new Error("此记录没有可预览内容。");
    }

    return {
      tab: {
        id: `timeline-entry:${timelineTarget.entryId}`,
        kind: "timeline-comparison",
        label: `预览：${timelineTarget.label}`,
        target: timelineTarget.sourceTarget,
        entryId: timelineTarget.entryId,
        entryMessage: timelineTarget.message,
        entryTimestamp: timelineTarget.timestamp,
        entryShortHash: timelineTarget.shortHash,
        displayPath: timelineTarget.displayPath,
        originalContent: historyContent.content,
        currentContent: current,
      },
    };
  },
};

const workbenchEditorTargetContributions = [
  resourceEditorContribution,
  manuscriptEditorContribution,
  timelineComparisonEditorContribution,
] as const;

function getWorkbenchEditorTargetContribution(
  target: WorkbenchEditorTarget,
): WorkbenchEditorTargetContribution {
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

export function getWorkbenchEditorTabTargetKey(tab: WorkbenchEditorTab): string {
  return getWorkbenchEditorTabContribution(tab).getTabTargetKey(tab);
}

export function resolveWorkbenchEditorTarget(
  target: WorkbenchEditorTarget,
  context: WorkbenchEditorTargetContributionContext,
): Promise<ResolvedWorkbenchEditorTarget> {
  return getWorkbenchEditorTargetContribution(target).resolveTarget(target, context);
}
