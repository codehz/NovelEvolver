/** Display name from a project .npk path (last segment, strips `.npk`). */
export function projectDisplayName(path: string): string {
  const segments = path.replace(/\/$/, "").split(/[/\\]/);
  const fileName = segments.at(-1) ?? path;
  return fileName.toLowerCase().endsWith(".npk") ? fileName.slice(0, -4) : fileName;
}

/** Prefer custom display name; fall back to path-derived name when empty/null. */
export function resolveProjectDisplayName(project: {
  path: string;
  displayName?: string | null;
}): string {
  const custom = project.displayName?.trim();
  if (custom !== undefined && custom !== "") {
    return custom;
  }
  return projectDisplayName(project.path);
}
