import { StateEffect, StateField, type EditorState, type Transaction } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";

import { findFirstToken } from "./token-scan";

export type PromptChipData = {
  promptId: string;
  slug: string;
  title: string;
  /** Snapshot of prompt body at insert time (used on send). */
  body: string;
};

export type PromptChipRange = {
  from: number;
  to: number;
  data: PromptChipData;
};

function promptToken(data: PromptChipData): string {
  return `/${data.slug}`;
}

/** Confirm / replace the single slash prompt ref. */
export const confirmPromptEffect = StateEffect.define<PromptChipData>();

/** Drop the prompt registry (composer clear). */
export const clearPromptRegistryEffect = StateEffect.define<null>();

/** @deprecated Use {@link confirmPromptEffect}. */
export const addPromptChipEffect = confirmPromptEffect;

/** @deprecated Use {@link clearPromptRegistryEffect}. */
export const clearPromptChipsEffect = clearPromptRegistryEffect;

export class PromptChipWidget extends WidgetType {
  constructor(readonly data: PromptChipData) {
    super();
  }

  eq(other: PromptChipWidget): boolean {
    return (
      this.data.promptId === other.data.promptId &&
      this.data.slug === other.data.slug &&
      this.data.title === other.data.title &&
      this.data.body === other.data.body
    );
  }

  toDOM(): HTMLElement {
    const el = document.createElement("span");
    el.className = "cm-prompt-chip";
    el.textContent = `/${this.data.slug}`;
    el.title = this.data.title !== "" ? `${this.data.title}\n${this.data.body}` : this.data.body;
    el.setAttribute("data-prompt-id", this.data.promptId);
    el.setAttribute("data-prompt-slug", this.data.slug);
    el.setAttribute("contenteditable", "false");
    el.setAttribute("spellcheck", "false");
    return el;
  }

  ignoreEvent(): boolean {
    return false;
  }

  get estimatedHeight(): number {
    return -1;
  }
}

function chipDecoration(data: PromptChipData) {
  return Decoration.replace({
    widget: new PromptChipWidget(data),
    inclusive: false,
  });
}

/**
 * Sticky single prompt registry.
 * Decorations only appear while `/${slug}` is present in the document.
 */
export const promptRegistryField = StateField.define<PromptChipData | null>({
  create() {
    return null;
  },
  update(current, tr) {
    let next = current;
    for (const effect of tr.effects) {
      if (effect.is(clearPromptRegistryEffect)) {
        next = null;
      } else if (effect.is(confirmPromptEffect)) {
        next = effect.value;
      }
    }
    return next;
  },
});

function buildPromptDecorations(state: EditorState): DecorationSet {
  const data = state.field(promptRegistryField, false);
  if (!data) {
    return Decoration.none;
  }
  const match = findFirstToken(state.doc.toString(), promptToken(data));
  if (!match) {
    return Decoration.none;
  }
  return Decoration.set([chipDecoration(data).range(match.from, match.to)]);
}

function registryTouched(tr: Transaction): boolean {
  for (const effect of tr.effects) {
    if (effect.is(confirmPromptEffect) || effect.is(clearPromptRegistryEffect)) {
      return true;
    }
  }
  return false;
}

/** Derived decoration — rebuilt from doc ∩ registry. */
export const promptChipsField = StateField.define<DecorationSet>({
  create(state) {
    return buildPromptDecorations(state);
  },
  update(deco, tr) {
    if (tr.docChanged || registryTouched(tr)) {
      return buildPromptDecorations(tr.state);
    }
    return deco;
  },
  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
});

export const promptChipTheme = EditorView.theme({
  ".cm-prompt-chip": {
    display: "inline-flex",
    verticalAlign: "baseline",
    alignItems: "center",
    maxWidth: "100%",
    margin: "0 0.1em",
    padding: "0 0.35em",
    borderRadius: "0.25rem",
    border: "1px solid color-mix(in srgb, var(--color-ctp-mauve) 35%, transparent)",
    backgroundColor: "color-mix(in srgb, var(--color-ctp-mauve) 14%, transparent)",
    color: "var(--color-ctp-mauve)",
    fontSize: "0.92em",
    fontWeight: "600",
    lineHeight: "1.4",
    whiteSpace: "nowrap",
    userSelect: "none",
  },
});

export function promptChipExtension() {
  return [promptRegistryField, promptChipsField, promptChipTheme];
}

/**
 * Active prompt chip only when registry is set **and** its token still appears in the doc.
 */
export function getActivePromptChip(state: EditorState): PromptChipRange | null {
  const data = state.field(promptRegistryField, false);
  if (!data) {
    return null;
  }
  const match = findFirstToken(state.doc.toString(), promptToken(data));
  if (!match) {
    return null;
  }
  return { from: match.from, to: match.to, data };
}

export function hasActivePromptChip(state: EditorState): boolean {
  return getActivePromptChip(state) !== null;
}

export function promptChipEndsAt(state: EditorState, pos: number): boolean {
  const chip = getActivePromptChip(state);
  return chip !== null && chip.to === pos;
}

export function rangeOverlapsChip(state: EditorState, from: number, to: number): boolean {
  const chip = getActivePromptChip(state);
  if (!chip) {
    return false;
  }
  return chip.from < to && chip.to > from;
}

export function getPromptChipData(
  state: EditorState,
  from: number,
  to: number,
): PromptChipData | null {
  const chip = getActivePromptChip(state);
  if (!chip || chip.from !== from || chip.to !== to) {
    return null;
  }
  return chip.data;
}
