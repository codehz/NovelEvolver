import { invertedEffects } from "@codemirror/commands";
import {
  StateEffect,
  StateField,
  type ChangeDesc,
  type EditorState,
  type Transaction,
} from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";

export type PromptChipData = {
  promptId: string;
  slug: string;
  title: string;
  /** Snapshot of prompt body at insert time (used on send). */
  body: string;
};

export type PromptChipRange = {
  /** Positions in the document **after** the transaction changes are applied. */
  from: number;
  to: number;
  data: PromptChipData;
};

function mapChipRange(value: PromptChipRange, mapping: ChangeDesc): PromptChipRange | undefined {
  const from = mapping.mapPos(value.from, 1);
  const to = mapping.mapPos(value.to, -1);
  if (from >= to) {
    return undefined;
  }
  return { from, to, data: value.data };
}

export const addPromptChipEffect = StateEffect.define<PromptChipRange>({
  map: mapChipRange,
});

/** Inverse of add — used so history undo/redo restores chip widgets. */
export const removePromptChipEffect = StateEffect.define<PromptChipRange>({
  map: mapChipRange,
});

export const clearPromptChipsEffect = StateEffect.define<null>();

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

function isValidChipRange(state: EditorState, from: number, to: number): boolean {
  return from >= 0 && to > from && to <= state.doc.length;
}

function chipDataAt(deco: DecorationSet, from: number, to: number): PromptChipData | null {
  let found: PromptChipData | null = null;
  deco.between(from, to, (f, t, value) => {
    if (f === from && t === to && value.spec.widget instanceof PromptChipWidget) {
      found = value.spec.widget.data;
      return false;
    }
    return undefined;
  });
  return found;
}

function collectChips(deco: DecorationSet): PromptChipRange[] {
  const chips: PromptChipRange[] = [];
  const iter = deco.iter();
  while (iter.value) {
    if (iter.value.spec.widget instanceof PromptChipWidget) {
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
    if (effect.is(clearPromptChipsEffect)) {
      next = Decoration.none;
      continue;
    }
    if (effect.is(removePromptChipEffect)) {
      const { from, to } = effect.value;
      next = next.update({
        filter: (f, t) => t <= from || f >= to,
      });
      continue;
    }
    if (effect.is(addPromptChipEffect)) {
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

export const promptChipsField = StateField.define<DecorationSet>({
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
const invertPromptChipEffects = invertedEffects.of((tr) => {
  const inverted = [];

  const startChips = tr.startState.field(promptChipsField);
  let cleared = false;

  for (const effect of tr.effects) {
    if (effect.is(addPromptChipEffect)) {
      inverted.push(removePromptChipEffect.of(effect.value));
    } else if (effect.is(removePromptChipEffect)) {
      inverted.push(addPromptChipEffect.of(effect.value));
    } else if (effect.is(clearPromptChipsEffect)) {
      cleared = true;
      for (const chip of collectChips(startChips)) {
        inverted.push(addPromptChipEffect.of(chip));
      }
    }
  }

  if (!cleared && tr.docChanged) {
    for (const chip of collectChips(startChips)) {
      const mappedFrom = tr.changes.mapPos(chip.from, 1);
      const mappedTo = tr.changes.mapPos(chip.to, -1);
      if (mappedFrom >= mappedTo) {
        inverted.push(addPromptChipEffect.of(chip));
      }
    }
  }

  return inverted;
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
  return [promptChipsField, promptChipTheme, invertPromptChipEffects];
}

export function rangeOverlapsChip(state: EditorState, from: number, to: number): boolean {
  const chips = state.field(promptChipsField);
  let overlaps = false;
  chips.between(from, to, () => {
    overlaps = true;
    return false;
  });
  return overlaps;
}

export function getPromptChipData(
  state: EditorState,
  from: number,
  to: number,
): PromptChipData | null {
  return chipDataAt(state.field(promptChipsField), from, to);
}
