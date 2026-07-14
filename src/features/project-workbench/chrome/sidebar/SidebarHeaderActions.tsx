import type { ReactNode } from "react";

import { SidebarHeaderActionsPortalContent } from "./sidebar-header-actions-portal";

type SidebarHeaderActionsProps = {
  children?: ReactNode;
};

export function SidebarHeaderActions({ children }: SidebarHeaderActionsProps) {
  if (children === undefined || children === null) {
    return null;
  }

  return <SidebarHeaderActionsPortalContent>{children}</SidebarHeaderActionsPortalContent>;
}
