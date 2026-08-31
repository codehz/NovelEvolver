import type { JournalRevisionCapture } from "../journal/journal-types";
import type { WorktreeSessionState } from "./state";

export type DocumentRevisionDomain = "manuscript" | "resource";

export function documentRevisionKey(domain: DocumentRevisionDomain, id: string): string {
  return `${domain}:${id}`;
}

export function getDocumentContentRevision(
  state: WorktreeSessionState,
  domain: DocumentRevisionDomain,
  id: string,
): number {
  return state.documentContentRevisions.get(documentRevisionKey(domain, id)) ?? 0;
}

export function bumpDocumentContentRevision(
  state: WorktreeSessionState,
  domain: DocumentRevisionDomain,
  id: string,
): number {
  const key = documentRevisionKey(domain, id);
  const next = (state.documentContentRevisions.get(key) ?? 0) + 1;
  state.documentContentRevisions.set(key, next);
  return next;
}

export function deleteDocumentContentRevision(
  state: WorktreeSessionState,
  domain: DocumentRevisionDomain,
  id: string,
): void {
  state.documentContentRevisions.delete(documentRevisionKey(domain, id));
}

/**
 * Maintain per-document content revisions from a journal capture.
 * Commit only records already-applied content changes — do not bump again.
 */
export function applyDocumentRevisionsFromJournal(
  state: WorktreeSessionState,
  capture: JournalRevisionCapture,
): void {
  if (capture.source === "commit") {
    return;
  }

  for (const operation of capture.operations) {
    if (operation.kind === "content" || operation.kind === "restore") {
      bumpDocumentContentRevision(state, operation.domain, operation.entityId);
      continue;
    }
    if (operation.kind === "delete") {
      deleteDocumentContentRevision(state, operation.domain, operation.entityId);
    }
  }
}

export function hydrateDocumentContentRevisions(
  state: WorktreeSessionState,
  manuscriptRows: readonly { id: string; type: string; contentRevision: number }[],
  resourceRows: readonly { id: string; type: string; contentRevision: number }[],
): void {
  state.documentContentRevisions.clear();
  for (const row of manuscriptRows) {
    if (row.type === "chapter" && row.contentRevision > 0) {
      state.documentContentRevisions.set(
        documentRevisionKey("manuscript", row.id),
        row.contentRevision,
      );
    }
  }
  for (const row of resourceRows) {
    if (row.type === "file" && row.contentRevision > 0) {
      state.documentContentRevisions.set(
        documentRevisionKey("resource", row.id),
        row.contentRevision,
      );
    }
  }
}

export function clearDocumentContentRevisions(state: WorktreeSessionState): void {
  state.documentContentRevisions.clear();
}
