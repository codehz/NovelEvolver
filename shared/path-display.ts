function normalizeForHomeCompare(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/\/$/, "");
}

/**
 * Replaces a leading home directory with `~` for compact UI display.
 * Storage and file I/O should keep the original absolute path.
 */
export function shortenHomePath(absolutePath: string, homeDir: string): string {
  const home = normalizeForHomeCompare(homeDir);
  const normalized = normalizeForHomeCompare(absolutePath);

  if (normalized === home) {
    return "~";
  }

  const prefix = `${home}/`;
  if (!normalized.startsWith(prefix)) {
    return absolutePath;
  }

  const remainder = normalized.slice(prefix.length);
  return `~/${remainder}`;
}
