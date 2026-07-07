import type { ReactNode } from "react";

import { SidebarHeaderActionsPortalContent } from "./sidebar-header-actions-portal";

export function SidebarHeaderActions({ children }: { children?: ReactNode }) {
  if (children === undefined || children === null) {
    return null;
  }

  return <SidebarHeaderActionsPortalContent>{children}</SidebarHeaderActionsPortalContent>;
}
