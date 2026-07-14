import { describe, expect, test } from "bun:test";

import { EditorState } from "@codemirror/state";

import { buildComposerSendPayload, isComposerStateEmpty } from "./composer-doc";
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
  test("detects bare slash at document start", () => {
    const q = detectSlashQuery(stateWithDoc("/"));
    expect(q).toEqual({ from: 0, to: 1, query: "" });
  });

  test("detects slash query at document start", () => {
    const q = detectSlashQuery(stateWithDoc("/exp"));
    expect(q).toEqual({ from: 0, to: 4, query: "exp" });
  });

  test("rejects slash after whitespace mid-doc", () => {
    expect(detectSlashQuery(stateWithDoc("hello /exp"))).toBeNull();
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

  test("ignores any slash while a prompt chip exists", () => {
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
      effects: addPromptChipEffect.of(data),
    }).state;
    expect(detectSlashQuery(withChip)).toBeNull();
  });

  test("does not reopen after chip even with trailing slash token", () => {
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
      effects: addPromptChipEffect.of(data),
    }).state;
    expect(detectSlashQuery(withChip)).toBeNull();
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

describe("buildComposerSendPayload", () => {
  test("plain draft returns full text without slash", () => {
    const state = stateWithDoc("第三章");
    expect(buildComposerSendPayload(state)).toEqual({
      text: "第三章",
      slash: null,
      mentions: [],
    });
  });

  test("chip + remainder keeps slash metadata and unexpanded remainder", () => {
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
      effects: addPromptChipEffect.of(data),
    }).state;
    expect(buildComposerSendPayload(next)).toEqual({
      text: " 第三章",
      slash: {
        promptId: "p1",
        slug: "expand",
        title: "扩写",
        body: "请扩写以下内容：",
      },
      mentions: [],
    });
    expect(isComposerStateEmpty(next)).toBe(false);
  });

  test("chip only is non-empty", () => {
    const data: PromptChipData = {
      promptId: "p1",
      slug: "expand",
      title: "扩写",
      body: "请扩写以下内容：",
    };
    const marker = "/expand";
    const state = EditorState.create({
      doc: marker,
      extensions: promptChipExtension(),
      selection: { anchor: marker.length },
    });
    const next = state.update({
      effects: addPromptChipEffect.of(data),
    }).state;
    expect(isComposerStateEmpty(next)).toBe(false);
    expect(buildComposerSendPayload(next).slash?.slug).toBe("expand");
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
