import { cn } from "../../lib/cn";
import { sidebarHeaderActionClass, sidebarHeaderIconClass } from "./sidebar-header-chrome";

const demoMessages = [
  {
    role: "assistant" as const,
    text: "你好，我是 AI 助手占位面板。后续可在此对话、改写章节或整理设定。",
  },
  {
    role: "user" as const,
    text: "请根据第一章的语气，给出一个开篇钩子（演示）。",
  },
  {
    role: "assistant" as const,
    text: "布局已就绪：右侧辅助栏独立于编辑区，便于对照文稿与建议。",
  },
];

export function AuxiliarySidebar({ visible }: { visible: boolean }) {
  if (!visible) {
    return null;
  }

  return (
    <aside
      aria-label="AI 助手"
      className="flex w-workbench-auxiliary shrink-0 flex-col border-l border-titlebar-border bg-workbench-sidebar"
    >
      <header className="flex h-workbench-tab shrink-0 items-center justify-between gap-2 border-b border-titlebar-border px-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-app-foreground">
          <span
            aria-hidden="true"
            className={cn(sidebarHeaderIconClass, "icon-[codicon--sparkle] text-ctp-mauve")}
          />
          <span className="truncate">AI 助手</span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            aria-label="新建对话（演示）"
            className={sidebarHeaderActionClass}
            type="button"
          >
            <span aria-hidden="true" className={cn(sidebarHeaderIconClass, "icon-[codicon--add]")} />
          </button>
          <button
            aria-label="更多操作（演示）"
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

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 text-sm">
          {demoMessages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "rounded-lg border border-titlebar-border px-3 py-2",
                message.role === "user"
                  ? "ml-4 bg-workbench-tab-active"
                  : "mr-4 bg-workbench-editor",
              )}
            >
              <p className="mb-1 text-xs font-medium text-ctp-subtext0">
                {message.role === "user" ? "你" : "助手"}
              </p>
              <p className="text-app-foreground">{message.text}</p>
            </div>
          ))}
        </div>

        <footer className="shrink-0 border-t border-titlebar-border p-3">
          <div className="flex items-end gap-2 rounded-lg border border-titlebar-border bg-workbench-editor p-2">
            <textarea
              aria-label="消息输入（演示）"
              className="min-h-16 flex-1 resize-none border-0 bg-transparent text-sm text-app-foreground outline-none placeholder:text-ctp-overlay0"
              placeholder="向 AI 提问…（仅布局演示）"
              readOnly
              rows={3}
            />
            <button
              aria-label="发送（演示）"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-badge-background text-badge-foreground hover:opacity-90"
              type="button"
            >
              <span aria-hidden="true" className="icon-[codicon--send] text-sm" />
            </button>
          </div>
        </footer>
      </div>
    </aside>
  );
}