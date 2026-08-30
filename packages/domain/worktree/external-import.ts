/** Max UTF-8 byte size for a single imported text file (64 KiB exclusive). */
export const EXTERNAL_IMPORT_MAX_FILE_BYTES = 64 * 1024;

/**
 * One filesystem entry relative to the import target parent folder.
 * Wire-level `file` is mapped by domain (resource → file, manuscript → chapter).
 */
export type ExternalImportEntry =
  | { kind: "folder"; relativePath: string }
  | { kind: "file"; relativePath: string; content: string };

export type ExternalImportSkipReason =
  | "name-conflict"
  | "type-conflict"
  | "invalid-name"
  | "too-large"
  | "empty-path"
  | "invalid-utf8"
  | "unreadable"
  | "missing-parent";

export type ExternalImportSkip = {
  relativePath: string;
  reason: ExternalImportSkipReason;
  message?: string;
};
