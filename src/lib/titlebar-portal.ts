import { createMagicPortal } from "foxact/create-magic-portal";

export const [TitleBarPortalProvider, TitleBarPortalTarget, TitleBarPortalContent] =
  createMagicPortal("TitleBar");

export const [
  TitleBarActionsPortalProvider,
  TitleBarActionsPortalTarget,
  TitleBarActionsPortalContent,
] = createMagicPortal("TitleBarActions");
