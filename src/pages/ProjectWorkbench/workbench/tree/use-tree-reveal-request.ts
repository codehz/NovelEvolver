import { useEffectEvent, useLayoutEffect, useRef } from "react";

export type TreeRevealRequestResult = "done" | "retry";

type UseTreeRevealRequestOptions<TTarget> = {
  onRevealRequest: (handler: (target: TTarget) => void) => () => void;
  reveal: (target: TTarget) => TreeRevealRequestResult;
  retryDeps?: readonly unknown[];
};

export function useTreeRevealRequest<TTarget>({
  onRevealRequest,
  reveal,
  retryDeps = [],
}: UseTreeRevealRequestOptions<TTarget>): void {
  const pendingRevealRef = useRef<TTarget | undefined>(undefined);
  const runReveal = useEffectEvent((target: TTarget) => {
    pendingRevealRef.current = reveal(target) === "retry" ? target : undefined;
  });

  useLayoutEffect(() => onRevealRequest(runReveal), [onRevealRequest, runReveal]);

  useLayoutEffect(() => {
    const pendingReveal = pendingRevealRef.current;
    if (pendingReveal !== undefined) {
      runReveal(pendingReveal);
    }
  }, [runReveal, ...retryDeps]);
}
