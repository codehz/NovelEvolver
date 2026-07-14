import { describe, expect, test } from "bun:test";

import { EditorState } from "@codemirror/state";

import {
  addMentionChipEffect,
  mentionChipExtension,
  type MentionChipData,
} from "./mention-chip-extension";
import {
  buildMentionToken,
  detectMentionQuery,
  filterMentionItems,
  type MentionCatalogItem,
} from "./mention-query";

function stateWithDoc(doc: string, cursor = doc.length): EditorState {
  return EditorState.create({
    doc,
    selection: { anchor: cursor },
  });
}

describe("detectMentionQuery", () => {
  test("detects bare @ at document start", () => {
    expect(detectMentionQuery(stateWithDoc("@"))).toEqual({ from: 0, to: 1, query: "" });
  });

  test("detects @query mid-doc after space", () => {
    expect(detectMentionQuery(stateWithDoc("请改 @第三章"))).toEqual({
      from: 3,
      to: 7,
      query: "第三章",
    });
  });

  test("detects path-like query", () => {
    expect(detectMentionQuery(stateWithDoc("@卷一/第"))).toEqual({
      from: 0,
      to: 5,
      query: "卷一/第",
    });
  });

  test("rejects email-like mid-word @", () => {
    expect(detectMentionQuery(stateWithDoc("a@b"))).toBeNull();
  });

  test("rejects non-empty selection", () => {
    const state = EditorState.create({
      doc: "@x",
      selection: { anchor: 0, head: 2 },
    });
    expect(detectMentionQuery(state)).toBeNull();
  });

  test("ignores caret inside existing mention chip", () => {
    const data: MentionChipData = {
      domain: "manuscript",
      id: "ch-3",
      kind: "chapter",
      label: "第三章",
      displayPath: "卷一/第三章",
      token: "@卷一/第三章",
    };
    const token = data.token;
    const base = EditorState.create({
      doc: token,
      extensions: mentionChipExtension(),
      selection: { anchor: token.length },
    });
    const withChip = base.update({
      effects: addMentionChipEffect.of({ from: 0, to: token.length, data }),
    }).state;
    // Caret at end of chip range still overlaps the decoration range.
    expect(detectMentionQuery(withChip)).toBeNull();
  });

  test("allows a new @ after an existing chip", () => {
    const data: MentionChipData = {
      domain: "manuscript",
      id: "ch-3",
      kind: "chapter",
      label: "第三章",
      displayPath: "卷一/第三章",
      token: "@卷一/第三章",
    };
    const token = data.token;
    const doc = `${token} @`;
    const base = EditorState.create({
      doc,
      extensions: mentionChipExtension(),
      selection: { anchor: doc.length },
    });
    const withChip = base.update({
      effects: addMentionChipEffect.of({ from: 0, to: token.length, data }),
    }).state;
    expect(detectMentionQuery(withChip)).toEqual({
      from: token.length + 1,
      to: doc.length,
      query: "",
    });
  });
});

describe("filterMentionItems", () => {
  const items: MentionCatalogItem[] = [
    {
      domain: "manuscript",
      id: "1",
      kind: "chapter",
      label: "第三章",
      displayPath: "卷一/第三章",
      rowLabel: "@第三章",
      detail: "卷一/第三章",
      kindLabel: "章节",
    },
    {
      domain: "resource",
      id: "2",
      kind: "file",
      label: "设定.md",
      displayPath: "设定.md",
      rowLabel: "@设定.md",
      detail: "设定.md",
      kindLabel: "资源",
    },
  ];

  test("filters by label and path", () => {
    expect(filterMentionItems(items, "第三").map((i) => i.id)).toEqual(["1"]);
    expect(filterMentionItems(items, "设定").map((i) => i.id)).toEqual(["2"]);
    expect(filterMentionItems(items, "").length).toBe(2);
  });
});

describe("buildMentionToken", () => {
  test("prefers displayPath", () => {
    expect(
      buildMentionToken({ id: "a", label: "第三章", displayPath: "卷一/第三章" }, new Set()),
    ).toBe("@卷一/第三章");
  });

  test("falls back to label when path empty", () => {
    expect(buildMentionToken({ id: "a", label: "根下", displayPath: "" }, new Set())).toBe("@根下");
  });

  test("disambiguates collisions with id slice", () => {
    const existing = new Set(["@卷一/第三章"]);
    expect(
      buildMentionToken(
        { id: "chapter-xyz", label: "第三章", displayPath: "卷一/第三章" },
        existing,
      ),
    ).toBe("@卷一/第三章#chapter-");
  });
});
