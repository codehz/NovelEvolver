import type {
  PlainTextEditorCaretPosition,
  PlainTextEditorLogicalPosition,
  PlainTextEditorSelectionSnapshot,
} from "#app/components/PlainTextEditor";

export type EditorCaretPosition = PlainTextEditorCaretPosition;
export type EditorLogicalPosition = PlainTextEditorLogicalPosition;
export type EditorSelectionSnapshot = PlainTextEditorSelectionSnapshot;

export function formatEditorCaretPosition(position: EditorCaretPosition): string {
  if (position.selectionLength === 0) {
    return `行 ${position.line}，列 ${position.column}`;
  }
  return `行 ${position.line}，列 ${position.column}（已选择 ${position.selectionLength}）`;
}
