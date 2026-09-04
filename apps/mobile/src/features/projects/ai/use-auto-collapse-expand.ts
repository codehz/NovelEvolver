import { useEffect, useRef, useState } from "react";

type UseAutoCollapseExpandOptions = {
  isLive: boolean;
  resetKey: string;
};

type UseAutoCollapseExpandResult = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
};

export function useAutoCollapseExpand({
  isLive,
  resetKey,
}: UseAutoCollapseExpandOptions): UseAutoCollapseExpandResult {
  const [open, setOpen] = useState(isLive);
  const userPinnedOpenRef = useRef(false);
  const userCollapsedDuringLiveRef = useRef(false);
  const prevLiveRef = useRef(isLive);
  const resetKeyRef = useRef(resetKey);

  useEffect(() => {
    if (resetKeyRef.current !== resetKey) {
      resetKeyRef.current = resetKey;
      userPinnedOpenRef.current = false;
      userCollapsedDuringLiveRef.current = false;
      prevLiveRef.current = isLive;
      setOpen(isLive);
      return;
    }

    const wasLive = prevLiveRef.current;
    prevLiveRef.current = isLive;

    if (isLive && !wasLive) {
      userPinnedOpenRef.current = false;
      userCollapsedDuringLiveRef.current = false;
      setOpen(true);
      return;
    }

    if (isLive) {
      if (!userCollapsedDuringLiveRef.current && !userPinnedOpenRef.current) {
        setOpen(true);
      }
      return;
    }

    if (!isLive && wasLive && !userPinnedOpenRef.current) {
      setOpen(false);
    }
  }, [isLive, resetKey]);

  function onOpenChange(next: boolean): void {
    setOpen(next);
    if (isLive && !next) {
      userCollapsedDuringLiveRef.current = true;
      userPinnedOpenRef.current = false;
      return;
    }
    if (next) {
      userPinnedOpenRef.current = true;
      userCollapsedDuringLiveRef.current = false;
      return;
    }
    userPinnedOpenRef.current = false;
  }

  return { open, onOpenChange };
}
