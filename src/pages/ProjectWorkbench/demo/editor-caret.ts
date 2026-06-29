import type {
  PlainTextEditorCaretPosition,
  PlainTextEditorLogicalPosition,
  PlainTextEditorSelectionSnapshot,
} from "@/components/PlainTextEditor";

export type EditorCaretPosition = PlainTextEditorCaretPosition;
export type EditorLogicalPosition = PlainTextEditorLogicalPosition;
export type EditorSelectionSnapshot = PlainTextEditorSelectionSnapshot;

export function formatEditorCaretPosition(position: EditorCaretPosition): string {
  if (position.selectionLength === 0) {
    return `Ln ${position.line}, Col ${position.column}`;
  }
  return `Ln ${position.line}, Col ${position.column} (${position.selectionLength} selected)`;
}
