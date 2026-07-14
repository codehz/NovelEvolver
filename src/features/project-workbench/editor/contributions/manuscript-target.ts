import { cn } from "#app/shared/lib/ui/cn";
import { contentFileLeafIconClass } from "#workbench/tree/content-tree-icons";

import type { WorkbenchEditorTab, WorkbenchEditorTarget } from "../state/types";
import type { WorkbenchEditorTargetContribution } from "./types";

export const manuscriptEditorContribution: WorkbenchEditorTargetContribution = {
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
