import { useSyncExternalStore } from "react";

export type AsyncState<T> = {
  data: T | undefined;
  error: unknown;
  isLoading: boolean;
  isValidating: boolean;
};

type Listener = () => void;

export interface AsyncLoader<T> {
  getState(this: void): AsyncState<T>;
  subscribe(this: void, listener: Listener): () => void;
  refresh(this: void): void;
}

/**
 * Creates an async state container with subscribe/getState/refresh.
 *
 * The returned object's methods are stable function references — they can be
 * destructured or passed directly without extra wrapping.
 *
 * @param asyncFn - The async function to execute.
 */
export function createAsyncLoader<T>(asyncFn: () => Promise<T>): AsyncLoader<T> {
  let state: AsyncState<T> = {
    data: undefined,
    error: undefined,
    isLoading: true,
    isValidating: true,
  };
  const listeners = new Set<Listener>();
  let counter = 0;

  function getState() {
    return state;
  }

  function subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function emit() {
    for (const listener of listeners) {
      listener();
    }
  }

  async function run() {
    counter++;
    const id = counter;

    const hasPrevData = state.data !== undefined;

    state = {
      data: state.data,
      error: undefined,
      isLoading: !hasPrevData,
      isValidating: true,
    };
    emit();

    try {
      const data = await asyncFn();
      if (id === counter) {
        state = { data, error: undefined, isLoading: false, isValidating: false };
        emit();
      }
    } catch (error) {
      if (id === counter) {
        state = { data: state.data, error, isLoading: false, isValidating: false };
        emit();
      }
    }
  }

  function refresh() {
    void run();
  }

  // Start immediately
  void run();

  return { getState, subscribe, refresh };
}

/**
 * Subscribes to an AsyncLoader via useSyncExternalStore.
 *
 * @param loader - The AsyncLoader created by createAsyncLoader.
 * @returns A tuple of [state, refresh].
 */
export function useAsyncLoader<T>(loader: AsyncLoader<T>): [AsyncState<T>, () => void] {
  const state = useSyncExternalStore(loader.subscribe, loader.getState);
  return [state, loader.refresh];
}
