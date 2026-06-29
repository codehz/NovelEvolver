import { useEffect, type ReactNode } from "react";

import { TitleBarPortalContent } from "@/lib/titlebar-portal";

export const defaultWindowTitle = "NovelEvolver";

function formatNativeWindowTitle(label: string): string {
  if (label === defaultWindowTitle) {
    return defaultWindowTitle;
  }
  return `${label} — ${defaultWindowTitle}`;
}

export function TitleBarTitle({ children }: { children: ReactNode }) {
  const label = typeof children === "string" && children.length > 0 ? children : defaultWindowTitle;
  const nativeTitle = formatNativeWindowTitle(label);

  useEffect(() => {
    void window.invokeIpc("window:set-title", nativeTitle);
  }, [nativeTitle]);

  return <TitleBarPortalContent>{children}</TitleBarPortalContent>;
}
