import { cn } from "../../lib/cn";
import type { WorkbenchDemoTab } from "./types";

const demoLines = [
  "# 第一章",
  "",
  "夜色落在稿纸上，编辑器骨架已经就位。",
  "左侧是活动栏与侧边栏，中间是文稿区域，右侧留给 AI 助手。",
  "",
  "（以上为布局演示文本，暂无真实编辑能力。）",
];

export function EditorArea({ tabs }: { tabs: WorkbenchDemoTab[] }) {
  return (
    <section
      aria-label="编辑器"
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-workbench-editor"
    >
      <div
        className="flex h-workbench-tab shrink-0 items-stretch border-b border-workbench-tab-border bg-workbench-tab-inactive"
        role="tablist"
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              "flex max-w-xs items-center gap-2 border-r border-workbench-tab-border px-3 text-sm",
              tab.active
                ? "bg-workbench-tab-active text-app-foreground"
                : "text-ctp-subtext0",
            )}
            role="tab"
            aria-selected={tab.active}
          >
            <span aria-hidden="true" className="icon-[codicon--file] text-sm" />
            <span className="truncate">{tab.label}</span>
            <button
              aria-label={`关闭 ${tab.label}`}
              className="ml-1 rounded p-0.5 hover:bg-window-button-hover"
              type="button"
            >
              <span aria-hidden="true" className="icon-[codicon--close] text-xs" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-titlebar-border bg-workbench-panel-header px-3 text-xs text-ctp-subtext0">
        <span className="icon-[codicon--chevron-right] text-sm" />
        <span>手稿</span>
        <span className="icon-[codicon--chevron-right] text-sm" />
        <span className="text-app-foreground">第一章.md</span>
      </div>

      <div className="flex min-h-0 flex-1 overflow-auto font-mono text-sm leading-6">
        <div
          aria-hidden="true"
          className="flex shrink-0 flex-col border-r border-titlebar-border bg-workbench-editor-gutter px-3 py-4 text-right text-ctp-overlay0 select-none"
        >
          {demoLines.map((_, index) => (
            <span key={index}>{index + 1}</span>
          ))}
        </div>
        <div className="min-w-0 flex-1 p-4 text-app-foreground">
          {demoLines.map((line, index) => (
            <div key={index} className="min-h-6 whitespace-pre-wrap">
              {line.length > 0 ? line : "\u00a0"}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}