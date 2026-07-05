import { useMemo, useState } from "react";

import { SidebarPaneStack } from "#app/components/workbench";
import { cn } from "#app/lib/cn";

import { ManuscriptSectionBody } from "../explorer/manuscript/ManuscriptSection";
import { ResourceLibrarySectionBody } from "../explorer/resource-library/ResourceLibrarySection";

type SidebarTreeNode = {
  icon: string;
  label: string;
  depth?: number;
  active?: boolean;
};

const timelineTree: SidebarTreeNode[] = [
  { icon: cn("icon-[codicon--history]"), label: "修订记录" },
  { icon: cn("icon-[codicon--circle-filled]"), label: "09:42 调整第一章节奏", depth: 1 },
  { icon: cn("icon-[codicon--circle-filled]"), label: "昨天 22:15 更新人物卡", depth: 1 },
  { icon: cn("icon-[codicon--circle-filled]"), label: "昨天 19:30 补充世界观设定", depth: 1 },
];

const DEFAULT_MANUSCRIPT_BODY_HEIGHT = 168;
const DEFAULT_REFERENCE_BODY_HEIGHT = 148;
const DEFAULT_TIMELINE_BODY_HEIGHT = 116;

function ExplorerTreeBody({ nodes, title }: { nodes: SidebarTreeNode[]; title: string }) {
  return (
    <ul className="flex flex-col gap-0.5 p-1" role="tree">
      {nodes.map((node) => (
        <li
          key={`${title}-${node.label}`}
          className={cn(
            "flex items-center gap-1.5 rounded px-1 py-0.5 text-app-foreground",
            node.depth ? "pl-5" : undefined,
            node.active && "bg-app-background",
          )}
          role="treeitem"
        >
          <span aria-hidden="true" className={cn(node.icon, "shrink-0 text-base")} />
          <span className="truncate">{node.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function ExplorerSidebar({ projectLabel }: { projectLabel: string }) {
  const [manuscriptExpanded, setManuscriptExpanded] = useState(true);
  const [referenceExpanded, setReferenceExpanded] = useState(true);
  const [timelineExpanded, setTimelineExpanded] = useState(true);

  const panes = useMemo(
    () => [
      {
        id: "manuscript",
        title: projectLabel,
        ariaLabel: projectLabel,
        panelId: "explorer-manuscript-panel",
        expanded: manuscriptExpanded,
        defaultBodyHeight: DEFAULT_MANUSCRIPT_BODY_HEIGHT,
        body: <ManuscriptSectionBody />,
        onToggleExpanded: () => setManuscriptExpanded((value) => !value),
      },
      {
        id: "reference",
        title: "资源库",
        ariaLabel: "资源库",
        panelId: "explorer-reference-panel",
        expanded: referenceExpanded,
        defaultBodyHeight: DEFAULT_REFERENCE_BODY_HEIGHT,
        body: <ResourceLibrarySectionBody />,
        onToggleExpanded: () => setReferenceExpanded((value) => !value),
      },
      {
        id: "timeline",
        title: "时间线",
        ariaLabel: "时间线",
        panelId: "explorer-timeline-panel",
        expanded: timelineExpanded,
        defaultBodyHeight: DEFAULT_TIMELINE_BODY_HEIGHT,
        body: <ExplorerTreeBody nodes={timelineTree} title="时间线" />,
        onToggleExpanded: () => setTimelineExpanded((value) => !value),
      },
    ],
    [manuscriptExpanded, projectLabel, referenceExpanded, timelineExpanded],
  );

  return <SidebarPaneStack panes={panes} />;
}
