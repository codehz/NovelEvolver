import { useEffect, type ReactNode } from "react";

import { windowService } from "@/lib/app-rpc";
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
    void windowService.setTitle(nativeTitle);
  }, [nativeTitle]);

  return <TitleBarPortalContent>{children}</TitleBarPortalContent>;
}
