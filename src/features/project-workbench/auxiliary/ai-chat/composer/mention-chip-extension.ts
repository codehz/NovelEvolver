import { invertedEffects } from "@codemirror/commands";
import {
  StateEffect,
  StateField,
  type ChangeDesc,
  type EditorState,
  type Transaction,
} from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";

import type { AiChatMentionRef } from "#shared/rpc/ai/index";

export type MentionChipData = AiChatMentionRef;

export type MentionChipRange = {
  /** Positions in the document **after** the transaction changes are applied. */
  from: number;
  to: number;
  data: MentionChipData;
};

function mapChipRange(value: MentionChipRange, mapping: ChangeDesc): MentionChipRange | undefined {
  const from = mapping.mapPos(value.from, 1);
  const to = mapping.mapPos(value.to, -1);
  if (from >= to) {
    return undefined;
  }
  return { from, to, data: value.data };
}

export const addMentionChipEffect = StateEffect.define<MentionChipRange>({
  map: mapChipRange,
});

/** Inverse of add — used so history undo/redo restores chip widgets. */
export const removeMentionChipEffect = StateEffect.define<MentionChipRange>({
  map: mapChipRange,
});

export const clearMentionChipsEffect = StateEffect.define<null>();

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

function isValidChipRange(state: EditorState, from: number, to: number): boolean {
  return from >= 0 && to > from && to <= state.doc.length;
}

function chipDataAt(deco: DecorationSet, from: number, to: number): MentionChipData | null {
  let found: MentionChipData | null = null;
  deco.between(from, to, (f, t, value) => {
    if (f === from && t === to && value.spec.widget instanceof MentionChipWidget) {
      found = value.spec.widget.data;
      return false;
    }
    return undefined;
  });
  return found;
}

function collectChips(deco: DecorationSet): MentionChipRange[] {
  const chips: MentionChipRange[] = [];
  const iter = deco.iter();
  while (iter.value) {
    if (iter.value.spec.widget instanceof MentionChipWidget) {
      chips.push({
        from: iter.from,
        to: iter.to,
        data: iter.value.spec.widget.data,
      });
    }
    iter.next();
  }
  return chips;
}

function updateChips(deco: DecorationSet, tr: Transaction): DecorationSet {
  let next = deco.map(tr.changes);

  for (const effect of tr.effects) {
    if (effect.is(clearMentionChipsEffect)) {
      next = Decoration.none;
      continue;
    }
    if (effect.is(removeMentionChipEffect)) {
      const { from, to } = effect.value;
      next = next.update({
        filter: (f, t) => t <= from || f >= to,
      });
      continue;
    }
    if (effect.is(addMentionChipEffect)) {
      const { from, to, data } = effect.value;
      if (!isValidChipRange(tr.state, from, to)) {
        continue;
      }
      next = next.update({
        add: [chipDecoration(data).range(from, to)],
        filter: (f, t) => t <= from || f >= to,
      });
    }
  }

  if (tr.docChanged && next.size > 0) {
    next = next.update({
      filter: (from, to) => to > from,
    });
  }

  return next;
}

export const mentionChipsField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(deco, tr) {
    return updateChips(deco, tr);
  },
  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
});

/**
 * History invert:
 * - add ⇄ remove (explicit effects)
 * - clear → re-add every chip from startState
 * - pure doc deletions that collapse a chip → re-add at startState positions
 */
const invertMentionChipEffects = invertedEffects.of((tr) => {
  const inverted = [];

  const startChips = tr.startState.field(mentionChipsField);
  let cleared = false;

  for (const effect of tr.effects) {
    if (effect.is(addMentionChipEffect)) {
      inverted.push(removeMentionChipEffect.of(effect.value));
    } else if (effect.is(removeMentionChipEffect)) {
      inverted.push(addMentionChipEffect.of(effect.value));
    } else if (effect.is(clearMentionChipsEffect)) {
      cleared = true;
      for (const chip of collectChips(startChips)) {
        inverted.push(addMentionChipEffect.of(chip));
      }
    }
  }

  if (!cleared && tr.docChanged) {
    for (const chip of collectChips(startChips)) {
      const mappedFrom = tr.changes.mapPos(chip.from, 1);
      const mappedTo = tr.changes.mapPos(chip.to, -1);
      if (mappedFrom >= mappedTo) {
        inverted.push(addMentionChipEffect.of(chip));
      }
    }
  }

  return inverted;
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
  return [mentionChipsField, mentionChipTheme, invertMentionChipEffects];
}

export function collectMentionChips(state: EditorState): MentionChipRange[] {
  const chips = state.field(mentionChipsField, false);
  if (!chips) {
    return [];
  }
  return collectChips(chips);
}

export function getMentionChipData(
  state: EditorState,
  from: number,
  to: number,
): MentionChipData | null {
  const chips = state.field(mentionChipsField, false);
  if (!chips) {
    return null;
  }
  return chipDataAt(chips, from, to);
}

export function collectMentionTokens(state: EditorState): Set<string> {
  const tokens = new Set<string>();
  for (const chip of collectMentionChips(state)) {
    tokens.add(chip.data.token);
  }
  return tokens;
}
