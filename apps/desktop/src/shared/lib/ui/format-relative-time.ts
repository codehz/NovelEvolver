const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function formatCompactDateTime(timestampMs: number): string {
  const date = new Date(timestampMs);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hours}:${minutes}`;
}

/** Relative label for activity timestamps (minutes → compact absolute). */
export function formatRelativeTime(timestampMs: number, nowMs = Date.now()): string {
  const delta = Math.max(0, nowMs - timestampMs);
  if (delta < MINUTE_MS) {
    return "刚刚";
  }
  if (delta < HOUR_MS) {
    return `${Math.floor(delta / MINUTE_MS)} 分钟前`;
  }
  if (delta < DAY_MS) {
    return `${Math.floor(delta / HOUR_MS)} 小时前`;
  }
  if (delta < 2 * DAY_MS) {
    return "昨天";
  }
  if (delta < 7 * DAY_MS) {
    return `${Math.floor(delta / DAY_MS)} 天前`;
  }
  return formatCompactDateTime(timestampMs);
}

export function formatAbsoluteTime(timestampMs: number): string {
  try {
    return new Date(timestampMs).toLocaleString();
  } catch {
    return formatCompactDateTime(timestampMs);
  }
}

/**
 * Delay until the relative label would change. `null` means no further updates
 * (already on the compact absolute form).
 */
export function getNextRelativeTimeUpdateDelay(
  timestampMs: number,
  nowMs = Date.now(),
): number | null {
  const delta = Math.max(0, nowMs - timestampMs);
  if (delta < MINUTE_MS) {
    return MINUTE_MS - delta;
  }
  if (delta < HOUR_MS) {
    return MINUTE_MS - (delta % MINUTE_MS) || MINUTE_MS;
  }
  if (delta < DAY_MS) {
    return HOUR_MS - (delta % HOUR_MS) || HOUR_MS;
  }
  if (delta < 2 * DAY_MS) {
    return 2 * DAY_MS - delta;
  }
  if (delta < 7 * DAY_MS) {
    return DAY_MS - (delta % DAY_MS) || DAY_MS;
  }
  return null;
}
