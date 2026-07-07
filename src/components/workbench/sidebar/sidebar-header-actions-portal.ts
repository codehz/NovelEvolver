import { createMagicPortal } from "foxact/create-magic-portal";

/**
 * Unified portal for rendering actions into the nearest sidebar header slot.
 *
 * `PrimarySidebarFrame` installs the outer host for views mounted directly in the
 * sidebar. Nested chrome like `SidebarViewSection` can install another provider
 * and target so descendants render into the nearest pane header instead.
 *
 * Because `createMagicPortal` is context-backed, actions always resolve to the
 * closest host: direct sidebar children target the sidebar title bar; pane
 * contents target their pane header.
 */
export const [
  SidebarHeaderActionsPortalProvider,
  SidebarHeaderActionsPortalTarget,
  SidebarHeaderActionsPortalContent,
] = createMagicPortal("SidebarHeaderActions");
