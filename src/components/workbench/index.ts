export type { ActivityViewId } from "./types";
export { WorkbenchLayout, type WorkbenchLayoutProps } from "./layout/WorkbenchLayout";
export {
  SidebarViewSection,
  SidebarSectionRowResizeHandle,
  SIDEBAR_SECTION_HEADER_HEIGHT_PX,
  SIDEBAR_SECTION_RESIZE_STRIP_HEIGHT,
} from "./sidebar/SidebarViewSection";
export {
  useSidebarPaneStack,
  MIN_SIDEBAR_SECTION_BODY_HEIGHT,
  type SidebarPaneStackPane,
  type SidebarPaneStackLayout,
  type SidebarPaneStackResizeHandle,
} from "./sidebar/use-sidebar-pane-stack";
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
