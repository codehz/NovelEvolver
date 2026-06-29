import { useSyncExternalStore } from "react";

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "hasData"; data: T }
  | { status: "hasError"; error: unknown };

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
  let state: AsyncState<T> = { status: "loading" };
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
    state = { status: "loading" };
    emit();

    try {
      const data = await asyncFn();
      if (id === counter) {
        state = { status: "hasData", data };
        emit();
      }
    } catch (error) {
      if (id === counter) {
        state = { status: "hasError", error };
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
