import { cn } from "../../lib/cn";
import { sidebarHeaderActionClass, sidebarHeaderIconClass } from "./sidebar-header-chrome";
import type { ActivityViewId } from "./types";

const viewTitles: Record<ActivityViewId, string> = {
  explorer: "资源管理器",
  search: "搜索",
  scm: "源代码管理",
};

const demoTree = [
  { icon: "icon-[codicon--folder-opened]", label: "手稿", open: true },
  { icon: "icon-[codicon--file]", label: "第一章.md", depth: 1 },
  { icon: "icon-[codicon--file]", label: "大纲.md", depth: 1 },
  { icon: "icon-[codicon--folder]", label: "设定", open: false },
];

export function PrimarySidebar({
  activeView,
  projectLabel,
}: {
  activeView: ActivityViewId;
  projectLabel: string;
}) {
  return (
    <aside
      aria-label={viewTitles[activeView]}
      className="flex w-workbench-sidebar shrink-0 flex-col bg-workbench-sidebar"
    >
      <header className="flex h-workbench-tab shrink-0 items-center justify-between gap-2 px-3 text-xs font-semibold tracking-wide text-workbench-sidebar-title uppercase">
        <span className="truncate">{viewTitles[activeView]}</span>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            aria-label="视图操作（演示）"
            className={sidebarHeaderActionClass}
            type="button"
          >
            <span
              aria-hidden="true"
              className={cn(sidebarHeaderIconClass, "icon-[codicon--ellipsis]")}
            />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-2 text-sm">
        {activeView === "explorer" ? (
          <div className="flex flex-col gap-1">
            <p className="px-1 text-xs text-ctp-subtext0" title={projectLabel}>
              {projectLabel}
            </p>
            <ul className="flex flex-col gap-0.5" role="tree">
              {demoTree.map((node) => (
                <li
                  key={node.label}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-1 py-0.5 text-app-foreground",
                    node.depth ? "pl-5" : undefined,
                    node.label === "第一章.md" && "bg-workbench-tab-active",
                  )}
                  role="treeitem"
                >
                  <span aria-hidden="true" className={cn(node.icon, "shrink-0 text-base")} />
                  <span className="truncate">{node.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {activeView === "search" ? (
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
        ) : null}

        {activeView === "scm" ? (
          <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-ctp-subtext0">
            <span aria-hidden="true" className="icon-[codicon--source-control] text-2xl" />
            <p>尚未配置版本控制。</p>
            <p className="text-ctp-overlay0">布局演示占位。</p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}