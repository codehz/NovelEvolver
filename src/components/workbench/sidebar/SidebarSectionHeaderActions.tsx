import type { ReactNode } from "react";

import { SidebarSectionActionsPortalContent } from "./sidebar-section-actions-portal";

export function SidebarSectionHeaderActions({ children }: { children?: ReactNode }) {
  if (children === undefined || children === null) {
    return null;
  }

  return <SidebarSectionActionsPortalContent>{children}</SidebarSectionActionsPortalContent>;
}
