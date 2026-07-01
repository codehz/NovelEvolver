/**
 * Path helpers for the per-branch resource library (paths relative to `resources/` root).
 */

/**
 * Validates a path relative to the resource library root.
 * `""` is the library root; non-empty paths follow Git-style virtual path rules.
 */
function throwIfInvalidSegmentName(segment: string, relativePath: string): void {
  if (segment === "." || segment === "..") {
    throw new Error(`Path must not contain '.' or '..': ${relativePath}`);
  }
  if (segment === "") {
    throw new Error(`Path must not contain empty segments: ${relativePath}`);
  }
}

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
    throwIfInvalidSegmentName(segment, relativePath);
  }
}

/** `ls` target: library root (`""`) or a folder path. */
export function assertResourceLibraryListPath(relativePath: string): void {
  assertValidResourceRelativePath(relativePath);
}

/** File read/write/delete source: must name a concrete file, not the library root. */
export function assertResourceLibraryFilePath(relativePath: string): void {
  assertValidResourceRelativePath(relativePath);
  if (relativePath === "") {
    throw new Error("File path must not be empty.");
  }
}

/** Folder creation target: must not be the library root. */
export function assertResourceLibraryFolderCreatePath(relativePath: string): void {
  assertValidResourceRelativePath(relativePath);
  if (relativePath === "") {
    throw new Error("Folder path must not be empty.");
  }
}

/** `unlink` / `move` source or destination (except move may target nested paths). */
export function assertResourceLibraryRemovablePath(relativePath: string): void {
  assertValidResourceRelativePath(relativePath);
  if (relativePath === "") {
    throw new Error("Cannot target the resource library root.");
  }
}

export function assertResourceLibraryMovePaths(from: string, to: string): void {
  assertResourceLibraryRemovablePath(from);
  assertValidResourceRelativePath(to);
  if (to === "") {
    throw new Error("Cannot move an entry to the resource library root.");
  }
  if (from === to) {
    throw new Error("Source and destination paths must differ.");
  }
}

/** Normalizes user input for create/rename: trim and strip outer slashes. */
export function normalizeResourceNameInput(name: string): string {
  return name.trim().replace(/^\/+|\/+$/g, "");
}

/** Parent directory of a resource path; top-level entries map to the library root (`""`). */
export function resourceParentPath(path: string): string {
  const lastSlash = path.lastIndexOf("/");
  return lastSlash >= 0 ? path.slice(0, lastSlash) : "";
}

/** Basename of a resource path; the library root returns `""`. */
export function resourceBaseName(path: string): string {
  if (path === "") {
    return "";
  }
  const lastSlash = path.lastIndexOf("/");
  return lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
}

/**
 * Remaps a path after moving/renaming an entry.
 * Files only rewrite exact matches; folders rewrite both the folder path and descendant paths.
 */
export function remapResourcePath(
  path: string,
  from: string,
  to: string,
  nodeType: "file" | "folder",
): string {
  if (nodeType === "file") {
    return path === from ? to : path;
  }
  if (path === from) {
    return to;
  }
  if (path.startsWith(`${from}/`)) {
    return `${to}${path.slice(from.length)}`;
  }
  return path;
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
  const parentPath = resourceParentPath(fullPath);
  if (parentPath === "") {
    return [];
  }
  return resourceLibraryDirPathPrefixes(parentPath);
}
