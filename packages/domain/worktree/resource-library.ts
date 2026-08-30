import {
  EXTERNAL_IMPORT_MAX_FILE_BYTES,
  type ExternalImportEntry,
  type ExternalImportSkip,
  type ExternalImportSkipReason,
} from "./external-import";
import type { WorktreeNodeIdResult } from "./manuscript";

/** @deprecated Prefer `EXTERNAL_IMPORT_MAX_FILE_BYTES`. */
export const RESOURCE_IMPORT_MAX_FILE_BYTES = EXTERNAL_IMPORT_MAX_FILE_BYTES;

export type ResourceImportEntry = ExternalImportEntry;
export type ResourceImportSkipReason = ExternalImportSkipReason;
export type ResourceImportSkip = ExternalImportSkip;

export type ResourceImportCreated = {
  nodeId: string;
  relativePath: string;
  kind: "file" | "folder";
};

export type ResourceImportResult = {
  created: ResourceImportCreated[];
  skipped: ResourceImportSkip[];
};

export type { WorktreeNodeIdResult };
