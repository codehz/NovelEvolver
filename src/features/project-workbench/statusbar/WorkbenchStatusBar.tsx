import {
  StatusBarLeftPortalContent,
  StatusBarRightPortalContent,
} from "#app/shared/lib/shell/statusbar-portal";
import { StatusBarItemButton, StatusBarMessage } from "#workbench/chrome";

import { BranchStatusItem } from "../branch/BranchStatusItem";
import { CaretPositionIndicator } from "./CaretPositionIndicator";

const leftStaticItems = [{ id: "sync", label: "同步", icon: "icon-[codicon--sync]" }];

const rightStaticItems = [
  { id: "encoding", label: "UTF-8" },
  { id: "eol", label: "LF" },
  { id: "language", label: "Markdown" },
];

export function WorkbenchStatusBar() {
  return (
    <>
      <StatusBarLeftPortalContent>
        <BranchStatusItem />
        {leftStaticItems.map((item) => (
          <StatusBarItemButton key={item.id} icon={item.icon}>
            {item.label}
          </StatusBarItemButton>
        ))}
        <StatusBarMessage>布局演示 — 状态栏占位</StatusBarMessage>
      </StatusBarLeftPortalContent>
      <StatusBarRightPortalContent>
        <CaretPositionIndicator />
        {rightStaticItems.map((item) => (
          <StatusBarItemButton key={item.id}>{item.label}</StatusBarItemButton>
        ))}
      </StatusBarRightPortalContent>
    </>
  );
}
