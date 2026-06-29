import type { WindowState } from "@shared/window";
import { windowService } from "./app-rpc";

type WindowStateSubscriptionOptions = {
  onState: (state: WindowState) => void;
  onError?: (error: unknown) => void;
};

export function subscribeWindowState({
  onState,
  onError,
}: WindowStateSubscriptionOptions): () => void {
  let canceled = false;
  let abortSubscription: (() => void) | null = null;

  void windowService
    .subscribeState()
    .then((stream) => {
      if (canceled) {
        void stream.cancel("Window state subscription disposed.").catch(() => undefined);
        return;
      }

      const abortController = new AbortController();
      abortSubscription = () => {
        abortController.abort();
      };

      void stream
        .pipeTo(
          new WritableStream<WindowState>({
            write: (state) => {
              onState(state);
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
