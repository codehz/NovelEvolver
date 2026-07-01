import { useEffect, useState } from "react";

import type { RpcStreamSubscribe } from "#shared/rpc/stream";
import type { WindowState } from "#shared/window";

import { windowService } from "./app-rpc";

type RpcStreamSubscriptionOptions<T> = {
  subscribe: RpcStreamSubscribe<T>;
  onValue: (value: T) => void;
  onError?: (error: unknown) => void;
  cancelReason?: string;
};

function consumeRpcStream<T>({
  subscribe,
  onValue,
  onError,
  cancelReason = "RPC stream subscription disposed.",
}: RpcStreamSubscriptionOptions<T>): () => void {
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

export function useWindowState(fallback: WindowState): WindowState {
  const [state, setState] = useState<WindowState>(fallback);

  useEffect(() => {
    return consumeRpcStream({
      subscribe: () => windowService.subscribeState(),
      onValue: setState,
      onError: () => {
        setState(fallback);
      },
      cancelReason: "Window state subscription disposed.",
    });
  }, [fallback]);

  return state;
}
