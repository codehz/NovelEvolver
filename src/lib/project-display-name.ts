/** Display name from a project .npk path (last segment, strips `.npk`). */
export function projectDisplayName(path: string): string {
  const segments = path.replace(/\/$/, "").split(/[/\\]/);
  const fileName = segments.at(-1) ?? path;
  return fileName.toLowerCase().endsWith(".npk") ? fileName.slice(0, -4) : fileName;
}