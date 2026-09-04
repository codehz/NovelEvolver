export const PARTIAL_SUMMARY_THROTTLE_MS = 250;

/**
 * Throttle helper for high-frequency report updates. Milestone events should
 * forceFlush instead of waiting for the interval.
 */
export function createViewThrottle<T>(options: {
  intervalMs?: number;
  onEmit: (value: T) => void;
}): {
  schedule: (value: T) => void;
  forceFlush: () => void;
  cancel: () => void;
} {
  const intervalMs = options.intervalMs ?? PARTIAL_SUMMARY_THROTTLE_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: T | null = null;
  let lastEmitAt = 0;

  const emit = (value: T) => {
    lastEmitAt = Date.now();
    pending = null;
    options.onEmit(value);
  };

  const schedule = (value: T) => {
    pending = value;
    const elapsed = Date.now() - lastEmitAt;
    if (elapsed >= intervalMs) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      emit(value);
      return;
    }
    if (timer) {
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      if (pending !== null) {
        emit(pending);
      }
    }, intervalMs - elapsed);
  };

  const forceFlush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending !== null) {
      emit(pending);
    }
  };

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pending = null;
  };

  return { schedule, forceFlush, cancel };
}
