/**
 * Path helpers for the per-branch resource library (paths relative to `resources/` root).
 */

/**
 * Validates a path relative to the resource library root.
 * `""` is the library root; non-empty paths follow Git-style virtual path rules.
 */
export function assertValidResourceRelativePath(relativePath: string): void {
  if (relativePath === "") {
    return;
  }
  if (relativePath.startsWith("/")) {
    throw new Error(`Path must not start with '/': ${relativePath}`);
  }
  if (relativePath.endsWith("/")) {
    throw new Error(`Path must not end with '/': ${relativePath}`);
  }
  if (relativePath.includes("//")) {
    throw new Error(`Path must not contain consecutive slashes: ${relativePath}`);
  }
  for (const segment of relativePath.split("/")) {
    if (segment === "." || segment === "..") {
      throw new Error(`Path must not contain '.' or '..': ${relativePath}`);
    }
    if (segment === "") {
      throw new Error(`Path must not contain empty segments: ${relativePath}`);
    }
  }
}

/** Normalizes user input for create/rename: trim and strip outer slashes. */
export function normalizeResourceNameInput(name: string): string {
  return name.trim().replace(/^\/+|\/+$/g, "");
}

/**
 * Joins a parent directory (relative to library root) with a user-entered name or nested relative path.
 */
export function joinResourceChildPath(parentPath: string, name: string): string {
  assertValidResourceRelativePath(parentPath);
  const relative = normalizeResourceNameInput(name);
  if (relative === "") {
    return "";
  }
  const full = parentPath === "" ? relative : `${parentPath}/${relative}`;
  assertValidResourceRelativePath(full);
  return full;
}

/** All directory path prefixes for a resource path (e.g. `a/b/c` → `a`, `a/b`, `a/b/c`). */
export function resourceLibraryDirPathPrefixes(path: string): string[] {
  if (path === "") {
    return [];
  }
  assertValidResourceRelativePath(path);
  const segments = path.split("/");
  const prefixes: string[] = [];
  for (let index = 0; index < segments.length; index += 1) {
    prefixes.push(segments.slice(0, index + 1).join("/"));
  }
  return prefixes;
}

/**
 * Directory paths to expand after creating a node at `fullPath`.
 * Files expand through their parent directory; folders include the new folder path.
 */
export function expandDirsAfterCreate(fullPath: string, kind: "file" | "folder"): string[] {
  if (fullPath === "") {
    return [];
  }
  if (kind === "folder") {
    return resourceLibraryDirPathPrefixes(fullPath);
  }
  const lastSlash = fullPath.lastIndexOf("/");
  if (lastSlash === -1) {
    return [];
  }
  return resourceLibraryDirPathPrefixes(fullPath.slice(0, lastSlash));
}
