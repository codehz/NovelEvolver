import type { EditorState } from "@codemirror/state";

import { promptChipsField, PromptChipWidget } from "./prompt-chip-extension";

/** Expand prompt chips to their body snapshot; leave plain text as-is. */
export function serializeComposerState(state: EditorState): string {
  const chips = state.field(promptChipsField);
  const doc = state.doc;
  let out = "";
  let pos = 0;
  const iter = chips.iter();
  while (iter.value) {
    out += doc.sliceString(pos, iter.from);
    const widget = iter.value.spec.widget;
    if (widget instanceof PromptChipWidget) {
      out += widget.data.body;
    } else {
      out += doc.sliceString(iter.from, iter.to);
    }
    pos = iter.to;
    iter.next();
  }
  out += doc.sliceString(pos, doc.length);
  return out;
}

export function isComposerStateEmpty(state: EditorState): boolean {
  return serializeComposerState(state).trim() === "";
}
