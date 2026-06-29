import { Fragment, useMemo, useState } from "react";

import { cn } from "../../../lib/cn";
import { ScrollArea } from "../../ScrollArea";
import { SidebarSectionRowResizeHandle, SidebarViewSection } from "../SidebarViewSection";
import { useSidebarPaneStack } from "../use-sidebar-pane-stack";

type DemoTreeNode = {
  icon: string;
  label: string;
  depth?: number;
  active?: boolean;
};

const manuscriptTree: DemoTreeNode[] = [
  { icon: cn("icon-[codicon--folder-opened]"), label: "手稿" },
  { icon: cn("icon-[codicon--file]"), label: "第一章.md", depth: 1, active: true },
  { icon: cn("icon-[codicon--file]"), label: "第二章.md", depth: 1 },
  { icon: cn("icon-[codicon--file]"), label: "番外·序.md", depth: 1 },
];

const referenceTree: DemoTreeNode[] = [
  { icon: cn("icon-[codicon--folder-opened]"), label: "设定" },
  { icon: cn("icon-[codicon--file]"), label: "世界观.md", depth: 1 },
  { icon: cn("icon-[codicon--file]"), label: "人物卡.md", depth: 1 },
  { icon: cn("icon-[codicon--folder]"), label: "素材" },
  { icon: cn("icon-[codicon--file]"), label: "地名参考.md", depth: 1 },
  { icon: cn("icon-[codicon--file]"), label: "大纲.md", depth: 1 },
];

const timelineTree: DemoTreeNode[] = [
  { icon: cn("icon-[codicon--history]"), label: "修订记录" },
  { icon: cn("icon-[codicon--circle-filled]"), label: "09:42 调整第一章节奏", depth: 1 },
  { icon: cn("icon-[codicon--circle-filled]"), label: "昨天 22:15 更新人物卡", depth: 1 },
  { icon: cn("icon-[codicon--circle-filled]"), label: "昨天 19:30 补充世界观设定", depth: 1 },
];

const DEFAULT_MANUSCRIPT_BODY_HEIGHT = 168;
const DEFAULT_REFERENCE_BODY_HEIGHT = 148;
const DEFAULT_TIMELINE_BODY_HEIGHT = 116;

function ExplorerTreeBody({ nodes, title }: { nodes: DemoTreeNode[]; title: string }) {
  return (
    <ul className="flex flex-col gap-0.5 p-1" role="tree">
      {nodes.map((node) => (
        <li
          key={`${title}-${node.label}`}
          className={cn(
            "flex items-center gap-1.5 rounded px-1 py-0.5 text-app-foreground",
            node.depth ? "pl-5" : undefined,
            node.active && "bg-workbench-tab-active",
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

export function ExplorerSidebarDemo({ projectLabel }: { projectLabel: string }) {
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
        body: <ExplorerTreeBody nodes={manuscriptTree} title="正文" />,
        onToggleExpanded: () => setManuscriptExpanded((value) => !value),
      },
      {
        id: "reference",
        title: "辅助资料",
        ariaLabel: "辅助资料",
        panelId: "explorer-reference-panel",
        expanded: referenceExpanded,
        defaultBodyHeight: DEFAULT_REFERENCE_BODY_HEIGHT,
        body: <ExplorerTreeBody nodes={referenceTree} title="辅助资料" />,
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
  const { stackRef, paneLayouts, resizeHandles, getResizeHandleProps } = useSidebarPaneStack({
    panes,
  });
  const paneTitleMap = useMemo(
    () => Object.fromEntries(panes.map((pane) => [pane.id, pane.title])),
    [panes],
  );

  return (
    <div ref={stackRef} className="-m-2 flex min-h-0 flex-1 flex-col overflow-hidden">
      {panes.map((pane) => {
        const layout = paneLayouts[pane.id];
        const resizeHandle = resizeHandles.find((handle) => handle.anchorPaneId === pane.id);
        const resizeHandleProps = resizeHandle ? getResizeHandleProps(resizeHandle.id) : null;

        return (
          <Fragment key={pane.id}>
            {resizeHandle && resizeHandleProps ? (
              <SidebarSectionRowResizeHandle
                active={resizeHandleProps.active}
                ariaLabel={`调整${paneTitleMap[resizeHandle.upperPaneId]}与${pane.title}区域高度`}
                onPointerDown={resizeHandleProps.onPointerDown}
              />
            ) : null}
            <SidebarViewSection
              ariaLabel={pane.ariaLabel}
              bodyFillsSection={layout?.bodyFillsSection}
              bodyStyle={layout?.bodyStyle}
              expanded={pane.expanded}
              panelId={pane.panelId}
              sectionStyle={layout?.sectionStyle}
              title={pane.title}
              onToggleExpanded={pane.onToggleExpanded}
            >
              {pane.body}
            </SidebarViewSection>
          </Fragment>
        );
      })}
    </div>
  );
}

export function SearchSidebarDemo() {
  return (
    <ScrollArea className="-m-2 min-h-0 flex-1" fill>
      <div className="flex flex-col gap-2 px-1">
        <label className="flex flex-col gap-1 text-xs text-ctp-subtext0">
          搜索
          <span className="flex items-center gap-2 rounded border border-titlebar-border bg-workbench-editor px-2 py-1.5">
            <span aria-hidden="true" className="icon-[codicon--search] text-sm" />
            <span className="text-ctp-overlay0">搜索文件内容（演示）</span>
          </span>
        </label>
        <p className="text-xs text-ctp-subtext0">输入关键词后将在此显示结果。</p>
      </div>
    </ScrollArea>
  );
}

export function ScmSidebarDemo() {
  return (
    <ScrollArea className="-m-2 min-h-0 flex-1" fill>
      <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-ctp-subtext0">
        <span aria-hidden="true" className="icon-[codicon--source-control] text-2xl" />
        <p>尚未配置版本控制。</p>
        <p className="text-ctp-overlay0">布局演示占位。</p>
      </div>
    </ScrollArea>
  );
}
