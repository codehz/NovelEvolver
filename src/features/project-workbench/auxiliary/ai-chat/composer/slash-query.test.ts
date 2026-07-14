import { describe, expect, test } from "bun:test";

import { EditorState } from "@codemirror/state";

import { serializeComposerState } from "./composer-doc";
import {
  addPromptChipEffect,
  promptChipExtension,
  type PromptChipData,
} from "./prompt-chip-extension";
import {
  detectSlashQuery,
  filterPromptSlashItems,
  toPromptSlashItems,
  type PromptSlashItem,
} from "./slash-query";

function stateWithDoc(doc: string, cursor = doc.length): EditorState {
  return EditorState.create({
    doc,
    selection: { anchor: cursor },
  });
}

describe("detectSlashQuery", () => {
  test("detects bare slash at start", () => {
    const q = detectSlashQuery(stateWithDoc("/"));
    expect(q).toEqual({ from: 0, to: 1, query: "" });
  });

  test("detects slash after whitespace with query", () => {
    const q = detectSlashQuery(stateWithDoc("hello /exp"));
    expect(q).toEqual({ from: 6, to: 10, query: "exp" });
  });

  test("rejects slash mid-word", () => {
    expect(detectSlashQuery(stateWithDoc("a/b"))).toBeNull();
  });

  test("rejects non-empty selection", () => {
    const state = EditorState.create({
      doc: "/x",
      selection: { anchor: 0, head: 2 },
    });
    expect(detectSlashQuery(state)).toBeNull();
  });

  test("ignores token that starts inside an existing prompt chip", () => {
    const data: PromptChipData = {
      promptId: "p1",
      slug: "expand",
      title: "扩写",
      body: "body",
    };
    const marker = "/expand";
    const base = EditorState.create({
      doc: `${marker}123`,
      extensions: promptChipExtension(),
      selection: { anchor: marker.length + 3 },
    });
    const withChip = base.update({
      effects: addPromptChipEffect.of({ from: 0, to: marker.length, data }),
    }).state;
    // Without the chip guard this would look like query "expand123".
    expect(detectSlashQuery(withChip)).toBeNull();
  });

  test("still detects a fresh slash after a chip when separated by whitespace", () => {
    const data: PromptChipData = {
      promptId: "p1",
      slug: "expand",
      title: "扩写",
      body: "body",
    };
    const marker = "/expand";
    const base = EditorState.create({
      doc: `${marker} /pol`,
      extensions: promptChipExtension(),
      selection: { anchor: marker.length + 5 },
    });
    const withChip = base.update({
      effects: addPromptChipEffect.of({ from: 0, to: marker.length, data }),
    }).state;
    expect(detectSlashQuery(withChip)).toEqual({
      from: marker.length + 1,
      to: marker.length + 5,
      query: "pol",
    });
  });
});

describe("filterPromptSlashItems", () => {
  const items: PromptSlashItem[] = [
    {
      id: "1",
      slug: "expand",
      title: "扩写",
      body: "body-expand",
      label: "/expand",
      detail: "扩写",
    },
    {
      id: "2",
      slug: "polish",
      title: "润色段落",
      body: "body-polish",
      label: "/polish",
      detail: "润色段落",
    },
  ];

  test("filters by slug and title", () => {
    expect(filterPromptSlashItems(items, "pol").map((i) => i.slug)).toEqual(["polish"]);
    expect(filterPromptSlashItems(items, "润色").map((i) => i.slug)).toEqual(["polish"]);
    expect(filterPromptSlashItems(items, "").length).toBe(2);
  });
});

describe("serializeComposerState", () => {
  test("expands chip body and keeps surrounding text", () => {
    const data: PromptChipData = {
      promptId: "p1",
      slug: "expand",
      title: "扩写",
      body: "请扩写以下内容：",
    };
    const marker = "/expand";
    const state = EditorState.create({
      doc: `${marker} 第三章`,
      extensions: promptChipExtension(),
      selection: { anchor: marker.length },
    });
    const next = state.update({
      effects: addPromptChipEffect.of({ from: 0, to: marker.length, data }),
    }).state;
    expect(serializeComposerState(next)).toBe("请扩写以下内容： 第三章");
  });
});

describe("toPromptSlashItems", () => {
  test("maps public config", () => {
    expect(toPromptSlashItems([{ id: "a", title: "T", slug: "t", prompt: "P" }])).toEqual([
      {
        id: "a",
        slug: "t",
        title: "T",
        body: "P",
        label: "/t",
        detail: "T",
      },
    ]);
  });
});
