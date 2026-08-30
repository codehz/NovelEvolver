import { createHash } from "node:crypto";

import type {
  WorktreeJournalEntityKind,
  WorktreeJournalOperationKind,
  WorktreeJournalSource,
} from "../../db/repositories/worktree-repo";

export type JournalOperationCapture = {
  kind: WorktreeJournalOperationKind;
  domain: "manuscript" | "resource";
  entityId: string;
  entityKind: WorktreeJournalEntityKind;
  label: string;
  displayPath: string;
  previousLabel?: string | null;
  previousPath?: string | null;
  beforeContent?: string | null;
  afterContent?: string | null;
};

export type JournalEntitySnapshot = {
  label: string;
  displayPath: string;
  content: string | null;
};

export type JournalRevisionCapture = {
  source: WorktreeJournalSource;
  title: string;
  commitHash?: string | null;
  groupKey: string | null;
  operations: JournalOperationCapture[];
};

export function sha1Text(content: string): string {
  return createHash("sha1").update(content).digest("hex");
}

export function journalHistoryEntryId(entryId: string): string {
  return `journal:${entryId}`;
}

export function parseJournalHistoryEntryId(entryId: string): string | null {
  const match = /^journal:([^:]+)$/.exec(entryId);
  if (match === null) {
    return null;
  }
  return match[1]!;
}
