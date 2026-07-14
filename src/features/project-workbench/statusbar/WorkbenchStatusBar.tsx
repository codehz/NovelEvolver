import {
  StatusBarLeftPortalContent,
  StatusBarRightPortalContent,
} from "#app/shared/lib/shell/statusbar-portal";
import { BranchStatusItem } from "#workbench/branch/BranchStatusItem";
import { StatusBarItemButton } from "#workbench/chrome";

import { AiContextStatusItem } from "./AiContextStatusItem";
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
      </StatusBarLeftPortalContent>
      <StatusBarRightPortalContent>
        <AiContextStatusItem />
        <CaretPositionIndicator />
        {rightStaticItems.map((item) => (
          <StatusBarItemButton key={item.id}>{item.label}</StatusBarItemButton>
        ))}
      </StatusBarRightPortalContent>
    </>
  );
}
