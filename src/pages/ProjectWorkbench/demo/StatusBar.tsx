import { formatEditorCaretPosition } from "./editor-caret";
import { useActiveTabCaretPosition } from "./use-active-tab-caret";

const leftItems = [
  { id: "branch", label: "main", icon: "icon-[codicon--source-control]" },
  { id: "sync", label: "同步", icon: "icon-[codicon--sync]" },
];

const rightStaticItems = [
  { id: "encoding", label: "UTF-8" },
  { id: "eol", label: "LF" },
  { id: "language", label: "Markdown" },
];

export function StatusBar() {
  const caret = useActiveTabCaretPosition();

  return (
    <footer
      aria-label="状态栏"
      className="flex h-workbench-status-bar shrink-0 items-stretch bg-workbench-status-bar font-mono text-xs text-workbench-status-bar-foreground"
    >
      <div className="flex min-w-0 flex-1 items-stretch overflow-hidden">
        {leftItems.map((item) => (
          <button
            key={item.id}
            className="flex shrink-0 items-center gap-1.5 px-2.5 hover:bg-window-button-hover"
            type="button"
          >
            <span aria-hidden="true" className={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
        <span className="flex min-w-0 flex-1 items-center truncate px-2.5 text-workbench-status-bar-muted">
          布局演示 — 状态栏占位
        </span>
      </div>
      <div className="flex shrink-0 items-stretch">
        {rightStaticItems.map((item) => (
          <button
            key={item.id}
            className="flex shrink-0 items-center px-2.5 hover:bg-window-button-hover"
            type="button"
          >
            {item.label}
          </button>
        ))}
        <span className="flex shrink-0 items-center px-2.5 tabular-nums">
          {formatEditorCaretPosition(caret)}
        </span>
      </div>
    </footer>
  );
}
