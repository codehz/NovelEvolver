import { useEffect, useRef, useState } from "react";

import type { RpcSubscribeFn } from "#shared/rpc/transport/index";
import type { WindowState } from "#shared/window";

import { windowService } from "./app-rpc";

const subscribeWindowState: RpcSubscribeFn<WindowState> = () => windowService.subscribeState();

type RpcSubscriptionOptions<T> = {
  subscribe: RpcSubscribeFn<T>;
  onValue: (value: T) => void;
  onError?: (error: unknown) => void;
  cancelReason?: string;
};

export function consumeRpcSubscription<T>({
  subscribe,
  onValue,
  onError,
  cancelReason = "RPC stream subscription disposed.",
}: RpcSubscriptionOptions<T>): () => void {
  let canceled = false;
  let abortSubscription: (() => void) | null = null;

  void Promise.resolve(subscribe())
    .then((stream) => {
      if (canceled) {
        void stream.cancel(cancelReason).catch(() => undefined);
        return;
      }

      const abortController = new AbortController();
      abortSubscription = () => {
        abortController.abort();
      };

      void stream
        .pipeTo(
          new WritableStream<T>({
            write: (value) => {
              onValue(value);
            },
          }),
          { signal: abortController.signal },
        )
        .catch((error) => {
          if (!canceled && !isAbortError(error)) {
            onError?.(error);
          }
        })
        .finally(() => {
          if (!canceled) {
            abortSubscription = null;
          }
        });
    })
    .catch((error) => {
      if (!canceled) {
        onError?.(error);
      }
    });

  return () => {
    canceled = true;
    abortSubscription?.();
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

type UseRpcSubscriptionOptions<T> = {
  subscribe: RpcSubscribeFn<T>;
  fallback: T;
  onError?: (error: unknown, fallback: T) => T;
  cancelReason?: string;
};

export function useRpcSubscription<T>({
  subscribe,
  fallback,
  onError,
  cancelReason,
}: UseRpcSubscriptionOptions<T>): T {
  const [state, setState] = useState<T>(fallback);
  const fallbackRef = useRef(fallback);
  const onErrorRef = useRef(onError);

  fallbackRef.current = fallback;
  onErrorRef.current = onError;

  useEffect(() => {
    setState(fallbackRef.current);
    return consumeRpcSubscription({
      subscribe,
      onValue: setState,
      onError: (error) => {
        const nextFallback = fallbackRef.current;
        const nextState = onErrorRef.current
          ? onErrorRef.current(error, nextFallback)
          : nextFallback;
        setState(nextState);
      },
      cancelReason,
    });
  }, [cancelReason, subscribe]);

  return state;
}

export function useWindowState(fallback: WindowState): WindowState {
  return useRpcSubscription({
    subscribe: subscribeWindowState,
    fallback,
    cancelReason: "Window state subscription disposed.",
  });
}
