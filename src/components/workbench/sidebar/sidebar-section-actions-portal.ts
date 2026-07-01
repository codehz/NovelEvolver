import { createMagicPortal } from "foxact/create-magic-portal";

/**
 * Per-section portal for rendering actions into a `SidebarViewSection` header.
 *
 * Each `SidebarViewSection` wraps its body subtree in
 * `SidebarSectionActionsPortalProvider`, so any descendant can render buttons
 * into that section's header action slot via `SidebarSectionActionsPortalContent`
 * (or the `useSidebarSectionActionsPortal()` hook).
 *
 * Because `createMagicPortal` is backed by React Context, nested sections each
 * capture their own nearest provider — multiple sections in one sidebar stack
 * stay independent.
 */
export const [
  SidebarSectionActionsPortalProvider,
  SidebarSectionActionsPortalTarget,
  SidebarSectionActionsPortalContent,
] = createMagicPortal("SidebarSectionActions");
