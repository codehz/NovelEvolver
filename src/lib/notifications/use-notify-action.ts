import { useCallback, useState } from "react";

import { notificationApi } from "./api";
import type { ShowNotificationOptions } from "./types";

export type RequestErrorMessage = string | ((error: unknown) => string);

export type NotifyActionWrapOptions = {
  readonly errorMessage?: RequestErrorMessage;
  /** Passed to `notificationApi.error` (e.g. `source`, `dedupeKey`). */
  readonly toast?: ShowNotificationOptions;
  readonly onError?: (error: unknown, message: string) => void | Promise<void>;
};

export type NotifyActionState = {
  readonly pending: boolean;
  readonly wrap: <TData>(
    action: () => Promise<TData> | TData,
    options?: NotifyActionWrapOptions,
  ) => Promise<TData>;
};

const suspendedPromise: Promise<never> = new Promise(() => {});

function resolveActionError(error: unknown, fallback?: RequestErrorMessage): string {
  if (typeof fallback === "function") {
    return fallback(error);
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback ?? "请求失败";
}

/**
 * Runs an async action; on failure shows an error toast and returns a promise that never settles
 */
export async function runNotifyAction<TData>(
  action: () => Promise<TData> | TData,
  options?: NotifyActionWrapOptions,
): Promise<TData> {
  try {
    return await action();
  } catch (actionError) {
    const message = resolveActionError(actionError, options?.errorMessage);
    notificationApi.error(message, options?.toast);
    await options?.onError?.(actionError, message);
    return suspendedPromise;
  }
}

export function useNotifyAction(): NotifyActionState {
  const [pendingCount, setPendingCount] = useState(0);
  const pending = pendingCount > 0;

  const wrap = useCallback(
    async <TData>(
      action: () => Promise<TData> | TData,
      options?: NotifyActionWrapOptions,
    ): Promise<TData> => {
      setPendingCount((count) => count + 1);
      try {
        return await runNotifyAction(action, options);
      } finally {
        setPendingCount((count) => Math.max(0, count - 1));
      }
    },
    [],
  );

  return { pending, wrap };
}
