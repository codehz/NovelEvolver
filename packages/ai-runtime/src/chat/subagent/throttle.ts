export const PARTIAL_SUMMARY_THROTTLE_MS = 250;
export const PARTIAL_SUMMARY_MAX_CHARS = 400;

/**
 * Keep the tail of a growing partial report so the UI shows what the child is
 * currently writing rather than the intro.
 */
export function truncatePartialSummary(
  text: string,
  maxChars: number = PARTIAL_SUMMARY_MAX_CHARS,
): string {
  if (maxChars <= 0) {
    return "";
  }
  const trimmed = text.trimEnd();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  if (maxChars === 1) {
    return "…";
  }
  return `…${trimmed.slice(-(maxChars - 1))}`;
}

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
