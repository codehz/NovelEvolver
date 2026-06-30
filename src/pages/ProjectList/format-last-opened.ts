export function formatLastOpened(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}
