import { cn } from "../../../lib/cn";
import { sidebarHeaderActionClass, sidebarHeaderIconClass } from "../sidebar/sidebar-header-chrome";

export function AuxiliarySidebar({
  visible,
  width,
  children,
}: {
  visible: boolean;
  width: number;
  children?: React.ReactNode;
}) {
  if (!visible) {
    return null;
  }

  return (
    <aside
      aria-label="AI 助手"
      className="flex w-workbench-auxiliary shrink-0 flex-col bg-workbench-sidebar"
      style={{ width }}
    >
      <header className="flex h-workbench-tab shrink-0 items-center justify-between gap-2 px-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-app-foreground">
          <span
            aria-hidden="true"
            className={cn(sidebarHeaderIconClass, "icon-[codicon--sparkle] text-ctp-mauve")}
          />
          <span className="truncate">AI 助手</span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button aria-label="新建对话（演示）" className={sidebarHeaderActionClass} type="button">
            <span
              aria-hidden="true"
              className={cn(sidebarHeaderIconClass, "icon-[codicon--add]")}
            />
          </button>
          <button aria-label="更多操作（演示）" className={sidebarHeaderActionClass} type="button">
            <span
              aria-hidden="true"
              className={cn(sidebarHeaderIconClass, "icon-[codicon--ellipsis]")}
            />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </aside>
  );
}
