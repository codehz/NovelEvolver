import { useCallback, useEffect, useRef } from "react";

import { notificationApi } from "#app/lib/notifications";

const AUTOSAVE_DEBOUNCE_MS = 600;

export function useTextAutosave(
  targetId: string | undefined,
  writeText: ((targetId: string, content: string) => Promise<void>) | undefined,
  source: string,
): (content: string) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<string>("");
  const writeRef = useRef(writeText);
  const targetRef = useRef(targetId);

  writeRef.current = writeText;
  targetRef.current = targetId;

  useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return useCallback(
    (content: string) => {
      latestRef.current = content;
      if (targetRef.current == null || targetRef.current === "" || writeRef.current == null) {
        return;
      }
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const target = targetRef.current;
        const write = writeRef.current;
        if (target == null || target === "" || write == null) {
          return;
        }
        void write(target, latestRef.current).catch((error) => {
          notificationApi.error(error instanceof Error ? error.message : "自动保存失败", {
            source,
          });
        });
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [source],
  );
}

export function useResourceAutosave(
  resourcePath: string | undefined,
  writeFile: ((path: string, content: string) => Promise<void>) | undefined,
): (content: string) => void {
  return useTextAutosave(resourcePath, writeFile, "资源库");
}
