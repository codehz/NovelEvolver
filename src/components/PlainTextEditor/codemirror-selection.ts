import type { EditorState, Text } from "@codemirror/state";
import { EditorSelection } from "@codemirror/state";
import type {
  PlainTextEditorCaretPosition,
  PlainTextEditorLogicalPosition,
  PlainTextEditorSelectionSnapshot,
} from "./types";

function compareLogicalPositions(
  a: PlainTextEditorLogicalPosition,
  b: PlainTextEditorLogicalPosition,
): number {
  if (a.lineIndex !== b.lineIndex) {
    return a.lineIndex - b.lineIndex;
  }
  return a.offset - b.offset;
}

function orderSelectionSnapshot(snapshot: PlainTextEditorSelectionSnapshot): {
  start: PlainTextEditorLogicalPosition;
  end: PlainTextEditorLogicalPosition;
} {
  return compareLogicalPositions(snapshot.anchor, snapshot.focus) <= 0
    ? { start: snapshot.anchor, end: snapshot.focus }
    : { start: snapshot.focus, end: snapshot.anchor };
}

export function isPlainTextEditorSelectionCollapsed(
  snapshot: PlainTextEditorSelectionSnapshot,
): boolean {
  return compareLogicalPositions(snapshot.anchor, snapshot.focus) === 0;
}

function logicalToDocPos(doc: Text, position: PlainTextEditorLogicalPosition): number {
  const lineNumber = Math.min(Math.max(position.lineIndex + 1, 1), doc.lines);
  const line = doc.line(lineNumber);
  const offset = Math.max(0, Math.min(position.offset, line.length));
  return line.from + offset;
}

function docPosToLogical(doc: Text, pos: number): PlainTextEditorLogicalPosition {
  const line = doc.lineAt(Math.max(0, Math.min(pos, doc.length)));
  return { lineIndex: line.number - 1, offset: pos - line.from };
}

export function selectionSnapshotFromState(state: EditorState): PlainTextEditorSelectionSnapshot {
  const doc = state.doc;
  const main = state.selection.main;
  return {
    anchor: docPosToLogical(doc, main.anchor),
    focus: docPosToLogical(doc, main.head),
  };
}

export function editorSelectionFromSnapshot(
  doc: Text,
  snapshot: PlainTextEditorSelectionSnapshot,
): EditorSelection {
  const anchor = logicalToDocPos(doc, snapshot.anchor);
  const head = logicalToDocPos(doc, snapshot.focus);
  return EditorSelection.create([EditorSelection.range(anchor, head)]);
}

function getSelectionLength(doc: Text, snapshot: PlainTextEditorSelectionSnapshot): number {
  const { start, end } = orderSelectionSnapshot(snapshot);
  if (compareLogicalPositions(start, end) === 0) {
    return 0;
  }

  if (start.lineIndex === end.lineIndex) {
    return Math.max(0, end.offset - start.offset);
  }

  let length = Math.max(0, doc.line(start.lineIndex + 1).length - start.offset);
  for (let index = start.lineIndex + 1; index < end.lineIndex; index += 1) {
    length += doc.line(index + 1).length;
  }
  length += end.offset;
  length += end.lineIndex - start.lineIndex;
  return length;
}

export function caretPositionFromState(state: EditorState): PlainTextEditorCaretPosition {
  const snapshot = selectionSnapshotFromState(state);
  return {
    line: snapshot.focus.lineIndex + 1,
    column: snapshot.focus.offset + 1,
    selectionLength: getSelectionLength(state.doc, snapshot),
  };
}
