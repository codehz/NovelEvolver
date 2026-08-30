import {
  findNext,
  findPrevious,
  replaceAll,
  replaceNext,
  SearchQuery,
  setSearchQuery,
} from "@codemirror/search";
import { EditorSelection, type EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export type EditorFindOptions = {
  search: string;
  replace?: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regexp?: boolean;
};

export type EditorFindMatchStats = {
  total: number;
  /** 1-based index of the currently selected match; 0 when none selected. */
  current: number;
};

export function createEditorFindQuery(options: EditorFindOptions): SearchQuery {
  return new SearchQuery({
    search: options.search,
    replace: options.replace ?? "",
    caseSensitive: options.caseSensitive ?? false,
    wholeWord: options.wholeWord ?? false,
    regexp: options.regexp ?? false,
    // Plain-text default: do not expand \n / \t unless the user enables regex.
    literal: !(options.regexp ?? false),
  });
}

export function emptyEditorFindQuery(): SearchQuery {
  return createEditorFindQuery({ search: "" });
}

export function getEditorFindSeedFromSelection(state: EditorState): string {
  const { from, to } = state.selection.main;
  if (from === to) {
    return "";
  }
  const text = state.sliceDoc(from, to);
  if (text.includes("\n")) {
    return "";
  }
  return text;
}

export function computeEditorFindMatchStats(
  state: EditorState,
  query: SearchQuery,
): EditorFindMatchStats {
  if (!query.valid || query.search === "") {
    return { total: 0, current: 0 };
  }

  let total = 0;
  let current = 0;
  const { from, to } = state.selection.main;
  const cursor = query.getCursor(state);
  for (let step = cursor.next(); !step.done; step = cursor.next()) {
    total += 1;
    if (step.value.from === from && step.value.to === to) {
      current = total;
    }
  }
  return { total, current };
}

function selectionIsCurrentMatch(state: EditorState, query: SearchQuery): boolean {
  if (!query.valid || query.search === "") {
    return false;
  }
  const { from, to } = state.selection.main;
  if (from === to) {
    return false;
  }
  const cursor = query.getCursor(state, from, to);
  const step = cursor.next();
  return !step.done && step.value.from === from && step.value.to === to;
}

function selectMatchRange(view: EditorView, from: number, to: number): void {
  view.dispatch({
    selection: EditorSelection.single(from, to),
    effects: EditorView.scrollIntoView(from, { y: "center" }),
  });
}

/** Select the first match at or after `fromPos`, wrapping to the document start. */
export function selectNearestEditorFindMatch(
  view: EditorView,
  query: SearchQuery,
  fromPos = view.state.selection.main.from,
): boolean {
  if (!query.valid || query.search === "") {
    return false;
  }

  const forward = query.getCursor(view.state, fromPos);
  const next = forward.next();
  if (!next.done) {
    selectMatchRange(view, next.value.from, next.value.to);
    return true;
  }

  const wrap = query.getCursor(view.state, 0, fromPos);
  const first = wrap.next();
  if (first.done) {
    return false;
  }
  selectMatchRange(view, first.value.from, first.value.to);
  return true;
}

/**
 * Push the query into CM search state and ensure a match is selected when possible.
 * Keeps the current selection if it already is a match for the new query.
 */
export function applyEditorFindQuery(
  view: EditorView,
  options: EditorFindOptions,
  {
    selectMatch = true,
  }: {
    selectMatch?: boolean;
  } = {},
): SearchQuery {
  const query = createEditorFindQuery(options);
  view.dispatch({ effects: setSearchQuery.of(query) });

  if (selectMatch && query.valid && query.search !== "") {
    if (!selectionIsCurrentMatch(view.state, query)) {
      selectNearestEditorFindMatch(view, query);
    }
  }

  return query;
}

export function clearEditorFindQuery(view: EditorView): void {
  view.dispatch({ effects: setSearchQuery.of(emptyEditorFindQuery()) });
}

export function runEditorFindNext(view: EditorView): boolean {
  return findNext(view);
}

export function runEditorFindPrevious(view: EditorView): boolean {
  return findPrevious(view);
}

export function runEditorReplaceNext(view: EditorView): boolean {
  return replaceNext(view);
}

export function runEditorReplaceAll(view: EditorView): boolean {
  return replaceAll(view);
}
