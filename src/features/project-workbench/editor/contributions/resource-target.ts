import { cn } from "#app/shared/lib/ui/cn";
import { contentFileLeafIconClass } from "#workbench/tree/content-tree-icons";

import type { WorkbenchEditorTab, WorkbenchEditorTarget } from "../state/types";
import type { WorkbenchEditorTargetContribution } from "./types";

export const resourceEditorContribution: WorkbenchEditorTargetContribution = {
  targetKind: "resource",
  tabKind: "resource",
  iconClass: cn(contentFileLeafIconClass("file"), "mr-1.5"),
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
