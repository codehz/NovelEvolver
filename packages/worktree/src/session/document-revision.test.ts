import { describe, expect, test } from "bun:test";

import type { JournalRevisionCapture } from "../journal/journal-types";
import {
  applyDocumentRevisionsFromJournal,
  bumpDocumentContentRevision,
  clearDocumentContentRevisions,
  documentRevisionKey,
  getDocumentContentRevision,
  hydrateDocumentContentRevisions,
} from "./document-revision";
import type { WorktreeSessionState } from "./state";

function emptyState(): WorktreeSessionState {
  return {
    documentContentRevisions: new Map(),
  } as WorktreeSessionState;
}

describe("document content revision", () => {
  test("get defaults to 0 and bump is per document", () => {
    const state = emptyState();
    expect(getDocumentContentRevision(state, "manuscript", "a")).toBe(0);
    expect(bumpDocumentContentRevision(state, "manuscript", "a")).toBe(1);
    expect(bumpDocumentContentRevision(state, "manuscript", "a")).toBe(2);
    expect(getDocumentContentRevision(state, "manuscript", "b")).toBe(0);
    expect(bumpDocumentContentRevision(state, "resource", "a")).toBe(1);
    expect(getDocumentContentRevision(state, "manuscript", "a")).toBe(2);
  });

  test("journal content/restore bumps; delete removes; commit skips", () => {
    const state = emptyState();
    bumpDocumentContentRevision(state, "manuscript", "keep");

    const contentCapture: JournalRevisionCapture = {
      source: "autosave",
      title: "自动保存",
      groupKey: null,
      operations: [
        {
          kind: "content",
          domain: "manuscript",
          entityId: "ch-1",
          entityKind: "chapter",
          label: "一",
          displayPath: "一",
        },
        {
          kind: "content",
          domain: "manuscript",
          entityId: "ch-2",
          entityKind: "chapter",
          label: "二",
          displayPath: "二",
        },
      ],
    };
    applyDocumentRevisionsFromJournal(state, contentCapture);
    expect(getDocumentContentRevision(state, "manuscript", "ch-1")).toBe(1);
    expect(getDocumentContentRevision(state, "manuscript", "ch-2")).toBe(1);
    expect(getDocumentContentRevision(state, "manuscript", "keep")).toBe(1);

    applyDocumentRevisionsFromJournal(state, {
      source: "restore",
      title: "恢复",
      groupKey: null,
      operations: [
        {
          kind: "restore",
          domain: "manuscript",
          entityId: "ch-1",
          entityKind: "chapter",
          label: "一",
          displayPath: "一",
        },
      ],
    });
    expect(getDocumentContentRevision(state, "manuscript", "ch-1")).toBe(2);

    applyDocumentRevisionsFromJournal(state, {
      source: "structure-edit",
      title: "删除",
      groupKey: null,
      operations: [
        {
          kind: "delete",
          domain: "manuscript",
          entityId: "ch-2",
          entityKind: "chapter",
          label: "二",
          displayPath: "二",
        },
      ],
    });
    expect(getDocumentContentRevision(state, "manuscript", "ch-2")).toBe(0);

    applyDocumentRevisionsFromJournal(state, {
      source: "commit",
      title: "提交",
      groupKey: null,
      operations: [
        {
          kind: "content",
          domain: "manuscript",
          entityId: "ch-1",
          entityKind: "chapter",
          label: "一",
          displayPath: "一",
        },
      ],
    });
    expect(getDocumentContentRevision(state, "manuscript", "ch-1")).toBe(2);

    applyDocumentRevisionsFromJournal(state, {
      source: "structure-edit",
      title: "重命名",
      groupKey: null,
      operations: [
        {
          kind: "rename",
          domain: "manuscript",
          entityId: "ch-1",
          entityKind: "chapter",
          label: "一改",
          displayPath: "一改",
        },
      ],
    });
    expect(getDocumentContentRevision(state, "manuscript", "ch-1")).toBe(2);
  });

  test("hydrate round-trip and clear", () => {
    const state = emptyState();
    hydrateDocumentContentRevisions(
      state,
      [
        { id: "folder", type: "folder", contentRevision: 9 },
        { id: "ch-1", type: "chapter", contentRevision: 4 },
        { id: "ch-2", type: "chapter", contentRevision: 0 },
      ],
      [{ id: "f-1", type: "file", contentRevision: 2 }],
    );
    expect(getDocumentContentRevision(state, "manuscript", "ch-1")).toBe(4);
    expect(getDocumentContentRevision(state, "manuscript", "ch-2")).toBe(0);
    expect(getDocumentContentRevision(state, "manuscript", "folder")).toBe(0);
    expect(getDocumentContentRevision(state, "resource", "f-1")).toBe(2);
    expect(state.documentContentRevisions.has(documentRevisionKey("manuscript", "ch-1"))).toBe(
      true,
    );

    clearDocumentContentRevisions(state);
    expect(getDocumentContentRevision(state, "manuscript", "ch-1")).toBe(0);
  });
});
