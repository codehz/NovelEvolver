import { StateEffect, StateField, type EditorState, type Transaction } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";

import type { AiChatMentionRef } from "#domain/ai";

import { findTokenMatches } from "./token-scan";

export type MentionChipData = AiChatMentionRef;

export type MentionChipRange = {
  from: number;
  to: number;
  data: MentionChipData;
};

/** Confirm / upsert a mention ref keyed by its in-document `token`. */
export const confirmMentionEffect = StateEffect.define<MentionChipData>();

/** Drop the entire mention registry (composer clear). */
export const clearMentionRegistryEffect = StateEffect.define<null>();

/** @deprecated Use {@link confirmMentionEffect} — kept as alias for call-site clarity during migrate. */
export const addMentionChipEffect = confirmMentionEffect;

/** @deprecated Use {@link clearMentionRegistryEffect}. */
export const clearMentionChipsEffect = clearMentionRegistryEffect;

export class MentionChipWidget extends WidgetType {
  constructor(readonly data: MentionChipData) {
    super();
  }

  eq(other: MentionChipWidget): boolean {
    return (
      this.data.domain === other.data.domain &&
      this.data.id === other.data.id &&
      this.data.kind === other.data.kind &&
      this.data.label === other.data.label &&
      this.data.displayPath === other.data.displayPath &&
      this.data.token === other.data.token
    );
  }

  toDOM(): HTMLElement {
    const el = document.createElement("span");
    el.className = "cm-mention-chip";
    el.textContent = `@${this.data.label}`;
    el.title =
      this.data.displayPath !== "" && this.data.displayPath !== this.data.label
        ? `${this.data.displayPath}\n${this.data.domain} · ${this.data.kind}`
        : `${this.data.domain} · ${this.data.kind}`;
    el.setAttribute("data-mention-id", this.data.id);
    el.setAttribute("data-mention-domain", this.data.domain);
    el.setAttribute("data-mention-kind", this.data.kind);
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

function chipDecoration(data: MentionChipData) {
  return Decoration.replace({
    widget: new MentionChipWidget(data),
    inclusive: false,
  });
}

/**
 * Sticky token → ref registry.
 * Tokens missing from the doc simply produce no decoration (soft chip);
 * undo that restores the token text re-derives the widget without invert effects.
 */
export const mentionRegistryField = StateField.define<ReadonlyMap<string, MentionChipData>>({
  create() {
    return new Map();
  },
  update(registry, tr) {
    let next: Map<string, MentionChipData> | null = null;
    for (const effect of tr.effects) {
      if (effect.is(clearMentionRegistryEffect)) {
        next = new Map();
        continue;
      }
      if (effect.is(confirmMentionEffect)) {
        const data = effect.value;
        if (data.token === "") {
          continue;
        }
        if (!next) {
          next = new Map(registry);
        }
        next.set(data.token, data);
      }
    }
    return next ?? registry;
  },
});

function buildMentionDecorations(state: EditorState): DecorationSet {
  const registry = state.field(mentionRegistryField, false);
  if (!registry || registry.size === 0) {
    return Decoration.none;
  }

  const text = state.doc.toString();
  const matches = findTokenMatches(text, [...registry.keys()]);
  if (matches.length === 0) {
    return Decoration.none;
  }

  const ranges = [];
  for (const match of matches) {
    const data = registry.get(match.token);
    if (!data) {
      continue;
    }
    ranges.push(chipDecoration(data).range(match.from, match.to));
  }
  return Decoration.set(ranges, true);
}

function registryTouched(tr: Transaction): boolean {
  for (const effect of tr.effects) {
    if (effect.is(confirmMentionEffect) || effect.is(clearMentionRegistryEffect)) {
      return true;
    }
  }
  return false;
}

/** Derived decoration set — rebuilt from doc ∩ registry, not range-mapped. */
export const mentionChipsField = StateField.define<DecorationSet>({
  create(state) {
    return buildMentionDecorations(state);
  },
  update(deco, tr) {
    if (tr.docChanged || registryTouched(tr)) {
      return buildMentionDecorations(tr.state);
    }
    return deco;
  },
  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
});

export const mentionChipTheme = EditorView.theme({
  ".cm-mention-chip": {
    display: "inline-flex",
    verticalAlign: "baseline",
    alignItems: "center",
    maxWidth: "100%",
    margin: "0 0.1em",
    padding: "0 0.35em",
    borderRadius: "0.25rem",
    border: "1px solid color-mix(in srgb, var(--color-ctp-teal) 35%, transparent)",
    backgroundColor: "color-mix(in srgb, var(--color-ctp-teal) 14%, transparent)",
    color: "var(--color-ctp-teal)",
    fontSize: "0.92em",
    fontWeight: "600",
    lineHeight: "1.4",
    whiteSpace: "nowrap",
    userSelect: "none",
  },
});

export function mentionChipExtension() {
  return [mentionRegistryField, mentionChipsField, mentionChipTheme];
}

export function collectMentionChips(state: EditorState): MentionChipRange[] {
  const registry = state.field(mentionRegistryField, false);
  if (!registry || registry.size === 0) {
    return [];
  }
  const matches = findTokenMatches(state.doc.toString(), [...registry.keys()]);
  const chips: MentionChipRange[] = [];
  for (const match of matches) {
    const data = registry.get(match.token);
    if (data) {
      chips.push({ from: match.from, to: match.to, data });
    }
  }
  return chips;
}

export function getMentionChipData(
  state: EditorState,
  from: number,
  to: number,
): MentionChipData | null {
  for (const chip of collectMentionChips(state)) {
    if (chip.from === from && chip.to === to) {
      return chip.data;
    }
  }
  return null;
}

/** Tokens currently registered (sticky — may include tokens absent from the doc). */
export function collectMentionTokens(state: EditorState): Set<string> {
  const registry = state.field(mentionRegistryField, false);
  if (!registry) {
    return new Set();
  }
  return new Set(registry.keys());
}

/** True when any derived mention chip ends exactly at `pos`. */
export function mentionChipEndsAt(state: EditorState, pos: number): boolean {
  for (const chip of collectMentionChips(state)) {
    if (chip.to === pos) {
      return true;
    }
  }
  return false;
}

/** Half-open overlap with any active (doc-present) mention chip. */
export function rangeOverlapsMentionChip(state: EditorState, from: number, to: number): boolean {
  for (const chip of collectMentionChips(state)) {
    if (chip.from < to && chip.to > from) {
      return true;
    }
  }
  return false;
}
