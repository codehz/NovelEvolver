export type { WorkbenchPrimaryView } from "./types";
export { WorkbenchLayout, type WorkbenchLayoutProps } from "./layout/WorkbenchLayout";
export {
  SidebarViewSection,
  SidebarSectionRowResizeHandle,
  SIDEBAR_SECTION_HEADER_HEIGHT_PX,
  SIDEBAR_SECTION_RESIZE_STRIP_HEIGHT,
} from "./sidebar/SidebarViewSection";
export {
  SidebarPaneStack,
  type SidebarPaneStackItem,
  type SidebarPaneStackProps,
} from "./sidebar/SidebarPaneStack";
export {
  SidebarSectionActionsPortalContent,
  SidebarSectionActionsPortalProvider,
  SidebarSectionActionsPortalTarget,
} from "./sidebar/sidebar-section-actions-portal";
export { sidebarHeaderActionClass, sidebarHeaderIconClass } from "./sidebar/sidebar-chrome";
export {
  SidebarHeaderActionButton,
  type SidebarHeaderActionButtonProps,
} from "./sidebar/SidebarHeaderActionButton";
export {
  statusBarIconOnlyButtonClass,
  statusBarItemButtonClass,
  statusBarItemButtonWithIconClass,
  statusBarItemInfoClass,
  statusBarItemInfoNumericClass,
  statusBarMessageClass,
} from "./statusbar/statusbar-chrome";
export {
  StatusBarItemButton,
  type StatusBarItemButtonProps,
} from "./statusbar/StatusBarItemButton";
export { StatusBarItemInfo, type StatusBarItemInfoProps } from "./statusbar/StatusBarItemInfo";
export { StatusBarMessage, type StatusBarMessageProps } from "./statusbar/StatusBarMessage";
