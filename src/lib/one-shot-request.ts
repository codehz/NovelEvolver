import { useEffectEvent, useLayoutEffect } from "react";

export type OneShotConsumeResult = "done" | "retry" | "skip";

export interface OneShotRequestChannel<T> {
  publish(this: void, payload: T): void;
  replay(this: void): void;
  subscribe(this: void, consumer: (payload: T) => OneShotConsumeResult): () => void;
  hasPending(this: void): boolean;
}

type PendingEntry<T> = {
  payload: T;
};

export function createOneShotRequestChannel<T>(): OneShotRequestChannel<T> {
  const consumers = new Set<(payload: T) => OneShotConsumeResult>();
  let pendingEntry: PendingEntry<T> | null = null;

  function dispatchPending() {
    const currentEntry = pendingEntry;
    if (currentEntry === null) {
      return;
    }

    for (const consumer of consumers) {
      const result = consumer(currentEntry.payload);
      if (result === "done") {
        if (pendingEntry === currentEntry) {
          pendingEntry = null;
        }
        return;
      }
    }
  }

  function publish(payload: T) {
    pendingEntry = { payload };
    dispatchPending();
  }

  function replay() {
    dispatchPending();
  }

  function subscribe(consumer: (payload: T) => OneShotConsumeResult) {
    consumers.add(consumer);
    return () => {
      consumers.delete(consumer);
    };
  }

  function hasPending() {
    return pendingEntry !== null;
  }

  return {
    publish,
    replay,
    subscribe,
    hasPending,
  };
}

type UseOneShotRequestConsumerOptions<T> = {
  subscribe: OneShotRequestChannel<T>["subscribe"];
  replay: OneShotRequestChannel<T>["replay"];
  consume: (payload: T) => OneShotConsumeResult;
  retryDeps?: readonly unknown[];
};

export function useOneShotRequestConsumer<T>({
  subscribe,
  replay,
  consume,
  retryDeps = [],
}: UseOneShotRequestConsumerOptions<T>): void {
  const runConsume = useEffectEvent((payload: T) => consume(payload));

  useLayoutEffect(() => subscribe(runConsume), [runConsume, subscribe]);

  useLayoutEffect(() => {
    replay();
  }, [replay, ...retryDeps]);
}
