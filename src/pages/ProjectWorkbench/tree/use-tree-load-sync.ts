import { useEffect, useEffectEvent } from "react";

type UseTreeLoadSyncOptions<TResult> = {
  load: () => Promise<TResult> | TResult;
  onStart: () => void;
  onSuccess: (result: TResult) => void;
  onError: (message: string) => void;
  fallbackErrorMessage: string;
  deps?: readonly unknown[];
};

export function useTreeLoadSync<TResult>({
  load,
  onStart,
  onSuccess,
  onError,
  fallbackErrorMessage,
  deps = [],
}: UseTreeLoadSyncOptions<TResult>): void {
  const runLoad = useEffectEvent(load);
  const runStart = useEffectEvent(onStart);
  const runSuccess = useEffectEvent(onSuccess);
  const runError = useEffectEvent(onError);

  useEffect(() => {
    let cancelled = false;

    runStart();
    void Promise.resolve(runLoad())
      .then((result) => {
        if (!cancelled) {
          runSuccess(result);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          runError(error instanceof Error ? error.message : fallbackErrorMessage);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fallbackErrorMessage, ...deps]);
}
