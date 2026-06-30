import { useCallback, useEffect, useRef } from "react";

import { notificationApi } from "@/lib/notifications";

const AUTOSAVE_DEBOUNCE_MS = 600;

export function useResourceAutosave(
  resourcePath: string | undefined,
  writeFile: ((path: string, content: string) => Promise<void>) | undefined,
): (content: string) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<string>("");
  const writeRef = useRef(writeFile);
  const pathRef = useRef(resourcePath);

  writeRef.current = writeFile;
  pathRef.current = resourcePath;

  useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return useCallback((content: string) => {
    latestRef.current = content;
    const path = pathRef.current;
    const write = writeRef.current;
    if (path == null || path === "" || write == null) {
      return;
    }
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void write(path, latestRef.current).catch((error) => {
        notificationApi.error(error instanceof Error ? error.message : "自动保存失败", {
          source: "资源库",
        });
      });
    }, AUTOSAVE_DEBOUNCE_MS);
  }, []);
}
