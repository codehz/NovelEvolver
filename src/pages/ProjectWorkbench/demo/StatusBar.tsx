import { useMolecule } from "bunshi/react";
import { useQueryRequest } from "@/lib/app-query";
import { formatEditorCaretPosition } from "./editor-caret";
import { useActiveTabCaretPosition } from "./use-active-tab-caret";
import { projectMolecule } from "./workbench-editor-molecules";

const leftStaticItems = [{ id: "sync", label: "同步", icon: "icon-[codicon--sync]" }];

const rightStaticItems = [
  { id: "encoding", label: "UTF-8" },
  { id: "eol", label: "LF" },
  { id: "language", label: "Markdown" },
];

const branchFallbackLabel = "无分支";

export function StatusBar() {
  const caret = useActiveTabCaretPosition();
  const project = useMolecule(projectMolecule);
  const branchQuery = useQueryRequest(() => project.handle.head, {
    args: [],
    deps: [project],
    errorMessage: branchFallbackLabel,
    initialData: null,
  });
  const branchLabel = branchQuery.data?.name ?? branchFallbackLabel;

  return (
    <footer
      aria-label="状态栏"
      className="flex h-workbench-status-bar shrink-0 items-stretch bg-workbench-status-bar text-xs text-workbench-status-bar-foreground"
    >
      <div className="flex min-w-0 flex-1 items-stretch overflow-hidden">
        <button
          className="flex shrink-0 items-center gap-1.5 px-2.5 hover:bg-window-button-hover"
          type="button"
          onClick={() => {
            void branchQuery.refresh();
          }}
        >
          <span aria-hidden="true" className="icon-[codicon--source-control]" />
          <span>{branchLabel}</span>
        </button>
        {leftStaticItems.map((item) => (
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
        <span className="flex shrink-0 items-center px-2.5 tabular-nums">
          {formatEditorCaretPosition(caret)}
        </span>
        {rightStaticItems.map((item) => (
          <button
            key={item.id}
            className="flex shrink-0 items-center px-2.5 hover:bg-window-button-hover"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
    </footer>
  );
}
