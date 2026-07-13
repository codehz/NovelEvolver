import { formatHistoryTime } from "#workbench/lib/format-history-time";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatRelativeActivityTime(timestampMs: number, nowMs = Date.now()): string {
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
  return formatHistoryTime(timestampMs);
}

export function formatAbsoluteActivityTime(timestampMs: number): string {
  try {
    return new Date(timestampMs).toLocaleString();
  } catch {
    return formatHistoryTime(timestampMs);
  }
}
