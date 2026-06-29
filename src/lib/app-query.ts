import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type DependencyList,
} from "react";

type RequestErrorMessage = string | ((error: unknown) => string);
type QueryArgs = readonly [...unknown[]];
const emptyDependencyList: DependencyList = [];

type QueryStateBase<TData> = {
  readonly clearError: () => void;
  readonly data: TData | undefined;
  readonly error: string | null;
  readonly hasLoaded: boolean;
  readonly loading: boolean;
  readonly reset: () => void;
  readonly setError: (message: string | null) => void;
};

export type RequestRunResult<TData> =
  | {
      readonly data: TData;
      readonly ok: true;
    }
  | {
      readonly error: string | null;
      readonly ok: false;
    };

export type ActionState = {
  readonly clearError: () => void;
  readonly error: string | null;
  readonly pending: boolean;
  readonly setError: (message: string | null) => void;
  readonly wrap: <TData>(
    action: () => Promise<TData> | TData,
    options?: {
      readonly errorMessage?: RequestErrorMessage;
      readonly onError?: (error: unknown, message: string) => void | Promise<void>;
    },
  ) => Promise<TData>;
};

export type QueryRequestState<TData> = QueryStateBase<TData> & {
  readonly initialLoading: boolean;
  readonly pending: boolean;
  readonly refreshing: boolean;
  readonly refresh: () => Promise<RequestRunResult<TData>>;
};

type QueryRequestOptionsBase<TData> = {
  readonly clearDataOnLoad?: boolean;
  readonly deps?: DependencyList;
  readonly errorMessage?: RequestErrorMessage;
  readonly initialData?: TData;
};

type QueryRequestOptions<TData, TArgs extends QueryArgs> = QueryRequestOptionsBase<TData> & {
  readonly args: TArgs | SkipToken;
};

type AsyncStateOptions<TData> = {
  readonly clearDataOnLoad?: boolean;
  readonly errorMessage?: RequestErrorMessage;
  readonly initialData?: TData;
};

type AsyncStateController<TData, TArgs extends QueryArgs> = QueryStateBase<TData> & {
  readonly cancel: () => void;
  readonly execute: (...args: TArgs) => Promise<RequestRunResult<TData>>;
};

export type SkipToken = typeof skipToken;

export const skipToken = Symbol("app-query.skip-token");

const suspendedPromise: Promise<never> = new Promise(() => {});

function resolveRequestError(error: unknown, fallback?: RequestErrorMessage): string {
  if (typeof fallback === "function") {
    return fallback(error);
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback ?? "请求失败";
}

function useAsyncState<TData, TArgs extends QueryArgs>(
  request: (...args: TArgs) => Promise<TData> | TData,
  { clearDataOnLoad = false, errorMessage, initialData }: AsyncStateOptions<TData> = {},
): AsyncStateController<TData, TArgs> {
  const [data, setData] = useState<TData | undefined>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const requestTokenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestTokenRef.current += 1;
    };
  }, []);

  const execute = useEffectEvent(async (...args: TArgs): Promise<RequestRunResult<TData>> => {
    const requestToken = requestTokenRef.current + 1;
    requestTokenRef.current = requestToken;

    setLoading(true);
    setError(null);
    if (clearDataOnLoad) {
      setData(initialData);
    }

    try {
      const result = await request(...args);
      if (!mountedRef.current || requestToken !== requestTokenRef.current) {
        return { data: result, ok: true };
      }
      setData(result);
      setHasLoaded(true);
      return { data: result, ok: true };
    } catch (requestError) {
      if (!mountedRef.current || requestToken !== requestTokenRef.current) {
        return { error: null, ok: false };
      }
      const resolvedError = resolveRequestError(requestError, errorMessage);
      setError(resolvedError);
      setHasLoaded(true);
      return { error: resolvedError, ok: false };
    } finally {
      if (mountedRef.current && requestToken === requestTokenRef.current) {
        setLoading(false);
      }
    }
  });

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    requestTokenRef.current += 1;
    setLoading(false);
  }, []);

  const reset = useCallback(() => {
    requestTokenRef.current += 1;
    setData(initialData);
    setLoading(false);
    setError(null);
    setHasLoaded(false);
  }, [initialData]);

  return {
    cancel,
    clearError,
    data,
    error,
    execute,
    hasLoaded,
    loading,
    reset,
    setError,
  };
}

export function useQueryRequest<TData, TArgs extends QueryArgs>(
  request: (...args: TArgs) => Promise<TData> | TData,
  options: QueryRequestOptions<TData, TArgs>,
): QueryRequestState<TData> {
  const { args, clearDataOnLoad = false, deps, errorMessage, initialData } = options;
  const state = useAsyncState<TData, TArgs>(request, {
    clearDataOnLoad,
    errorMessage,
    initialData,
  });
  const shouldSkip = args === skipToken;
  const resolvedArgs: TArgs | null = shouldSkip ? null : args;
  const initialLoading = !shouldSkip && !state.hasLoaded;
  const refreshing = state.loading && state.hasLoaded;
  const loading = initialLoading || state.loading;

  useEffect(() => {
    if (shouldSkip) {
      state.cancel();
      return;
    }
    const nextArgs = resolvedArgs as TArgs;
    void state.execute(...nextArgs);
    // `useEffectEvent` should be invoked from the effect body, not treated as a
    // signal for rerunning the query; the query should only rerun when args/deps change.
  }, [shouldSkip, ...(resolvedArgs ?? []), ...(deps ?? emptyDependencyList)]);

  const refresh = useCallback(() => {
    if (!resolvedArgs) {
      return Promise.resolve({ error: null, ok: false } as const);
    }
    return state.execute(...resolvedArgs);
  }, [resolvedArgs, state.execute]);

  return {
    clearError: state.clearError,
    data: state.data,
    error: state.error,
    hasLoaded: state.hasLoaded,
    initialLoading,
    loading,
    pending: loading,
    refreshing,
    refresh,
    reset: state.reset,
    setError: state.setError,
  };
}

export function useAutoQueryRequest<TData>(
  request: () => Promise<TData> | TData,
  options: QueryRequestOptionsBase<TData> = {},
): QueryRequestState<TData> {
  return useQueryRequest(request, {
    ...options,
    args: [],
  });
}

export function useActionState(): ActionState {
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pending = pendingCount > 0;

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const wrap = useCallback(
    async <TData>(
      action: () => Promise<TData> | TData,
      options?: {
        readonly errorMessage?: RequestErrorMessage;
        readonly onError?: (error: unknown, message: string) => void | Promise<void>;
      },
    ): Promise<TData> => {
      setPendingCount((count) => count + 1);
      setError(null);

      try {
        const result = await action();
        return result;
      } catch (actionError) {
        const resolvedError = resolveRequestError(actionError, options?.errorMessage);
        setError(resolvedError);
        await options?.onError?.(actionError, resolvedError);
        return suspendedPromise;
      } finally {
        setPendingCount((count) => Math.max(0, count - 1));
      }
    },
    [],
  );

  return {
    clearError,
    error,
    pending,
    setError,
    wrap,
  };
}
