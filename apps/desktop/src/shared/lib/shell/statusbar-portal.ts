import { createMagicPortal } from "foxact/create-magic-portal";

export const [StatusBarLeftPortalProvider, StatusBarLeftPortalTarget, StatusBarLeftPortalContent] =
  createMagicPortal("StatusBarLeft");

export const [
  StatusBarRightPortalProvider,
  StatusBarRightPortalTarget,
  StatusBarRightPortalContent,
] = createMagicPortal("StatusBarRight");
