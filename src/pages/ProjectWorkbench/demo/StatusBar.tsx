import { StatusBarLeftPortalContent, StatusBarRightPortalContent } from "@/lib/statusbar-portal";

import { BranchStatusItem } from "./BranchStatusItem";
import { CaretPositionIndicator } from "./CaretPositionIndicator";

const leftStaticItems = [{ id: "sync", label: "同步", icon: "icon-[codicon--sync]" }];

const rightStaticItems = [
  { id: "encoding", label: "UTF-8" },
  { id: "eol", label: "LF" },
  { id: "language", label: "Markdown" },
];

export function StatusBar() {
  return (
    <>
      <StatusBarLeftPortalContent>
        <BranchStatusItem />
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
      </StatusBarLeftPortalContent>
      <StatusBarRightPortalContent>
        <CaretPositionIndicator />
        {rightStaticItems.map((item) => (
          <button
            key={item.id}
            className="flex shrink-0 items-center px-2.5 hover:bg-window-button-hover"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </StatusBarRightPortalContent>
    </>
  );
}
