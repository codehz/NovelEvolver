import { getSearchQuery } from "@codemirror/search";
import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";

const matchMark = Decoration.mark({ class: "cm-searchMatch" });
const selectedMatchMark = Decoration.mark({
  class: "cm-searchMatch cm-searchMatch-selected",
});

/**
 * Highlights SearchQuery matches without requiring CodeMirror's built-in search panel.
 * (Upstream highlighter only paints while the panel is open.)
 */
export const editorFindHighlight = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildFindDecorations(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        !getSearchQuery(update.state).eq(getSearchQuery(update.startState))
      ) {
        this.decorations = buildFindDecorations(update.view);
      }
    }
  },
  {
    decorations: (value) => value.decorations,
  },
);

function buildFindDecorations(view: EditorView): DecorationSet {
  const query = getSearchQuery(view.state);
  if (!query.valid || query.search === "") {
    return Decoration.none;
  }

  const builder = new RangeSetBuilder<Decoration>();
  const ranges = view.visibleRanges;
  for (let i = 0; i < ranges.length; i += 1) {
    let { from, to } = ranges[i]!;
    // Merge near-adjacent visible ranges like upstream search highlighter.
    while (i < ranges.length - 1 && to > ranges[i + 1]!.from - 500) {
      i += 1;
      to = ranges[i]!.to;
    }

    const cursor = query.getCursor(view.state, from, to);
    for (let step = cursor.next(); !step.done; step = cursor.next()) {
      const matchFrom = step.value.from;
      const matchTo = step.value.to;
      const selected = view.state.selection.ranges.some(
        (range) => range.from === matchFrom && range.to === matchTo,
      );
      builder.add(matchFrom, matchTo, selected ? selectedMatchMark : matchMark);
    }
  }

  return builder.finish();
}
