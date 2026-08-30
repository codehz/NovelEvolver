function formatHistoryDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hours}:${minutes}`;
}

export function formatHistoryTime(timestampMs: number): string {
  return formatHistoryDate(new Date(timestampMs));
}

export function formatCommitTime(timestampSeconds: number): string {
  return formatHistoryTime(timestampSeconds * 1000);
}
