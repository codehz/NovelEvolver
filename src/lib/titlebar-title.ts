import { atom, useSetAtom } from "jotai";
import { useEffect } from "react";

import { windowService } from "@/lib/app-rpc";

export const defaultWindowTitle = "NovelEvolver";

export const titleBarTitleAtom = atom(defaultWindowTitle);

function formatNativeWindowTitle(label: string): string {
  if (label === defaultWindowTitle) {
    return defaultWindowTitle;
  }
  return `${label} — ${defaultWindowTitle}`;
}

/** Sets in-app title bar label and native window title for the current route subtree. */
export function useTitleBarTitle(title: string) {
  const setTitle = useSetAtom(titleBarTitleAtom);
  const label = title.length > 0 ? title : defaultWindowTitle;
  const nativeTitle = formatNativeWindowTitle(label);

  useEffect(() => {
    setTitle(label);
    return () => {
      setTitle(defaultWindowTitle);
    };
  }, [label, setTitle]);

  useEffect(() => {
    void windowService.setTitle(nativeTitle);
  }, [nativeTitle]);
}
